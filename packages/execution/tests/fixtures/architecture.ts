import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { stringify } from 'yaml';
import {
  architectureGate,
  architectureQuestion,
  prepareArchitectureProposal,
  type Capture,
} from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { textDigest } from '../../../foundation/src/index.js';
import { git } from '../../src/git.js';
import { HostTask } from '../../src/index.js';

/** Exercise approvals, protected file writes and checkpoints using a real repository and SQLite journal. */
export class ArchitectureFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-architecture-'));
  readonly workspace = join(this.root, 'project');
  readonly storage = join(this.root, 'state');
  readonly parent: HostTask;
  readonly child: HostTask;
  readonly proposal;
  readonly original = '# Service\n\n| SERVICE-1 | Original requirement |\n';

  private readonly contract = {
    id: 'service',
    owner: 'service',
    stage: 'locked',
    file: 'contract.md',
    digest: textDigest(this.original),
  };

  /** Prepare one generic captured authority and an actual admitted parent/child writer pair. */
  constructor(t: TestContext, recordProposal = true, goal = 'Deliver approved architecture') {
    const capture = this.prepare();
    this.parent = this.task(capture);
    const child = this.parent.journal.child(goal, 'delivery');
    assert(child instanceof Journal);
    this.child = new HostTask(this.parent.config, child.goal, child, this.parent);
    Object.assign(this.child, { worktree: this.workspace, branch: '10-task', issue: '10' });
    this.proposal = prepareArchitectureProposal(capture, {
      purpose: 'Clarify the service',
      consequences: ['One additional invariant'],
      implementation: [],
      changes: [
        { path: 'contract.md', content: this.original + '| SERVICE-2 | New requirement |\n' },
      ],
    });
    if (recordProposal)
      this.parent.note({
        architectureProposal: {
          proposal: this.proposal,
          report: this.parent.store('proposal.md', architectureQuestion(this.proposal)),
        },
      });
    this.provider(t);
    t.after(() => {
      this.parent.journal.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Commit fixture authority before exercising byte-bound approvals and durable checkpoints. */
  private prepare() {
    mkdirSync(this.workspace);
    git(this.workspace, 'init', '-b', '10-task');
    git(this.workspace, 'config', 'user.name', 'Architecture test');
    git(this.workspace, 'config', 'user.email', 'fixture@example.invalid');
    const initial = this.capture();
    for (const path of initial.source.paths)
      writeFileSync(join(this.workspace, path), initial.source.read(path));
    git(this.workspace, 'add', '.');
    git(this.workspace, 'commit', '-m', 'Fixture baseline');
    const capture = {
      ...initial,
      source: { ...initial.source, revision: git(this.workspace, 'rev-parse', 'HEAD') },
    };
    return capture;
  }

  /** Obtain the actual host question and durable receipt without synthesizing an approval event. */
  async decide(answer?: string) {
    this.parent.ask = async () => answer;
    return this.parent.requestDecision(
      this.parent.capture.project.architect!,
      architectureGate(this.proposal),
      architectureQuestion(this.proposal),
      new AbortController().signal,
    );
  }

  /** Isolate external GitHub transport while retaining actual Git checkpoint commits and host observations. */
  private provider(t: TestContext) {
    let head: string | undefined;
    t.mock.method(GitHub.prototype, 'remoteHead', async () => head);
    t.mock.method(
      GitHub.prototype,
      'push',
      async (_root: string, _branch: string, commit: string) => {
        head = commit;
      },
    );
  }

  /** Admit the root using the same project key and storage as subsequent host tasks. */
  private task(capture: Capture) {
    const journal = new Coordination(this.storage).admit(
      capture.source.remote,
      'Architecture assessment',
    );
    assert(journal instanceof Journal);
    return new HostTask(
      {
        capture,
        common: join(this.workspace, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      journal.goal,
      journal,
    );
  }

  /** Supply explicit generic authority, including a real registry and uniquely owned contract. */
  private capture(): Capture {
    const entry = this.contract;
    const registry = stringify({
      authority: { lockOwner: 'Fixture architect' },
      contracts: [entry],
    });
    return {
      source: {
        root: this.workspace,
        revision: '',
        remote: 'https://github.com/example/fixture.git',
        paths: ['contract.md', 'registry.yaml'],
        read: (path: string) => (path === 'registry.yaml' ? registry : this.original),
      },
      project: {
        contractRegistry: 'registry.yaml',
        architect: { component: 'architecture', activity: 'updating' },
      },
      contracts: [entry],
      components: {
        service: {
          id: 'service',
          owns: ['contract.md'],
          activities: { review: { profile: 'profile' } },
        },
      },
    } as unknown as Capture;
  }
}
