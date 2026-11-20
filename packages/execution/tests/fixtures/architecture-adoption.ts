import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { stringify } from 'yaml';
import {
  Architecture,
  architectureGate,
  architectureQuestion,
  prepareArchitectureProposal,
} from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { HostTask } from '../../src/index.js';
import { git } from '../../src/git.js';

/** Supply a complete committed generic architecture, real approval gate and real checkpoint journal. */
export class AdoptionFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-adoption-'));
  readonly workspace = join(this.root, 'project');
  readonly architecture = new Architecture();
  readonly parent: HostTask;
  readonly task: HostTask;
  readonly proposal;

  /** Prepare an exactly approved operation/activity update without using the repository's own policy. */
  constructor(context: TestContext, handler = 'check', command = '/usr/bin/true') {
    this.prepare();
    const capture = this.architecture.capture(this.workspace);
    this.parent = this.admit(capture);
    const journal = this.parent.journal.child('Deliver a useful guide', 'delivery');
    assert(journal instanceof Journal);
    this.task = new HostTask(this.parent.config, journal.goal, journal, this.parent);
    Object.assign(this.task, { worktree: this.workspace, branch: '10-task', issue: '10' });
    this.proposal = this.propose(handler, command);
    this.parent.note({ architectureProposal: { proposal: this.proposal, report: 'fixture' } });
    this.provider(context);
    context.after(() => {
      this.parent.journal.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Record the genuine exact host question and human answer through the normal decision mechanism. */
  async approve() {
    this.parent.ask = async () => 'approve';
    await this.parent.requestDecision(
      this.parent.capture.project.architect!,
      architectureGate(this.proposal),
      architectureQuestion(this.proposal),
      new AbortController().signal,
    );
  }

  /** Add an ordinary committed candidate edit for unauthorized-authority and ownership scenarios. */
  commit(path: string, text: string) {
    this.write(path, text);
    git(this.workspace, 'add', path);
    git(this.workspace, 'commit', '-m', 'Fixture candidate change');
  }

  /** Keep the production approval and checkpoint path while isolating hosted GitHub mutations. */
  private provider(context: TestContext) {
    let head: string | undefined;
    context.mock.method(GitHub.prototype, 'remoteHead', async () => head);
    context.mock.method(GitHub.prototype, 'push', async (_: string, __: string, commit: string) => {
      head = commit;
    });
  }

  /** Build a complete architecture rooted in one real Git repository, with ownership for every file. */
  private prepare() {
    mkdirSync(this.workspace);
    git(this.workspace, 'init', '-b', '10-task');
    git(this.workspace, 'config', 'user.name', 'Adoption fixture');
    git(this.workspace, 'config', 'user.email', 'fixture@example.invalid');
    git(this.workspace, 'remote', 'add', 'origin', 'https://github.com/example/fixture.git');
    for (const [path, content] of Object.entries(definitions)) this.write(path, content);
    this.write('src/service.txt', 'Original implementation');
    this.write('registry.yaml', stringify({ contracts: [] }));
    git(this.workspace, 'add', '.');
    git(this.workspace, 'commit', '-m', 'Fixture authority');
  }

  /** Admit the foreground writer that owns this architecture phase and its sequential child. */
  private admit(capture: ReturnType<Architecture['capture']>) {
    const storage = join(this.root, 'state');
    const journal = new Coordination(storage).admit(capture.source.remote, 'Assess architecture');
    assert(journal instanceof Journal);
    return new HostTask(
      {
        capture,
        common: join(this.workspace, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage,
      },
      journal.goal,
      journal,
    );
  }

  /** Propose exact new declarations and a required check without granting candidate-side authority. */
  private propose(handler: string, command: string) {
    return prepareArchitectureProposal(this.task.capture, {
      purpose: 'Make the implemented check available to subsequent activities',
      consequences: ['Service completion requires the actual check result'],
      implementation: [],
      changes: this.changes(handler, command),
    });
  }

  /** Construct the complete operation and activity bytes that the fixture human actually reviews. */
  private changes(handler: string, command: string) {
    const component = this.task.capture.components.service!;
    const operation = {
      id: 'service-check',
      category: 'build',
      tool: handler,
      command,
      network: false,
    };
    return [
      {
        path: '.arc/architecture/operations/service-check.yaml',
        content: stringify(operation),
      },
      {
        path: '.arc/architecture/components/service.yaml',
        content: stringify({
          ...component,
          activities: {
            ...component.activities,
            implementation: {
              ...component.activities.implementation,
              operations: ['service-check'],
              verification: ['service-check'],
            },
          },
        }),
      },
    ];
  }

  /** Write authored fixture bytes without an overlay source or simulated capture. */
  private write(path: string, content: string) {
    mkdirSync(dirname(join(this.workspace, path)), { recursive: true });
    writeFileSync(join(this.workspace, path), content);
  }
}

const activity = {
  role: 'engineer',
  profile: 'worker',
  instructions: ['Perform the accepted responsibility.'],
  operations: [],
  standards: [],
};

const definitions: Record<string, string> = {
  '.arc/architecture/project.yaml': stringify({
    id: 'fixture',
    remote: 'https://github.com/example/fixture.git',
    contractRegistry: 'registry.yaml',
    planTemplate: '.arc/architecture/plan.md',
    director: { component: 'architecture', activity: 'updating' },
    verifier: { component: 'architecture', activity: 'updating' },
    architect: { component: 'architecture', activity: 'updating' },
    checks: { acceptance: [] },
  }),
  '.arc/architecture/plan.md': '# Plan\n',
  '.arc/architecture/components/architecture.yaml': stringify({
    id: 'architecture',
    purpose: 'Maintain approved guides',
    owns: ['.arc', 'registry.yaml', 'AGENTS.md'],
    activities: { updating: activity },
  }),
  '.arc/architecture/components/service.yaml': stringify({
    id: 'service',
    purpose: 'Provide the service',
    owns: ['src'],
    activities: { implementation: activity, review: activity },
  }),
  '.arc/architecture/roles/engineer.yaml': stringify({
    id: 'engineer',
    purpose: 'Perform engineering',
  }),
  '.arc/architecture/execution-profiles/worker.yaml': stringify({
    id: 'worker',
    model: 'fixture-provider',
    reasoning: 'medium',
    webSearch: 'disabled',
    operationCategories: ['build'],
  }),
};
