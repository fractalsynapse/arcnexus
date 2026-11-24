import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import type { ActivityOutcome } from '../../src/index.js';
import { ActivationTools } from '../../../execution/src/activation-tools.js';
import type { CheckResult } from '../../../execution/src/check.js';
import { git } from '../../../execution/src/git.js';
import { Clarifications, HostTask, steward } from '../../../execution/src/index.js';
import { textDigest } from '../../../foundation/src/index.js';
import {
  answer,
  correction,
  question,
  selection,
} from '../../../execution/tests/fixtures/reviewed-hold.js';
import { controlledCheckLaunch } from './reviewed-check-process.js';
import { holdFiles } from '../../../execution/tests/fixtures/reviewed-hold-project.js';

const signal = new AbortController().signal;
const remote = 'https://github.com/example/reviewed-hold.git';
const focus = {
  purpose: 'Correct independent rejection without losing context',
  objectives: ['Keep original acceptance'],
  constraints: ['Preserve captured authority'],
};

/** Build retained rejected Git/SQLite state with a production confined check operation. */
export class ReviewedTask {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-workflow-hold-'));
  readonly root = join(this.directory, 'project');
  readonly storage = join(this.directory, 'state');
  readonly interpreter = join(this.root, '.git', 'selected node');
  task: HostTask;
  readonly checks: CheckResult[] = [];
  readonly receipts: unknown[] = [];
  readonly rejection;
  private head?: string;

  /** Capture committed authority before retaining an independent rejection and its correction plan. */
  constructor(t: TestContext, retainedReview = true) {
    controlledCheckLaunch(t);
    mkdirSync(this.root);
    this.source();
    this.task = this.open(t);
    this.rejection = this.reviewEvidence();
    this.recordReview();
    t.after(() => {
      this.task.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Persist distinct complete review artifacts without recycling prior tool transcripts. */
  private reviewEvidence() {
    return {
      kind: 'rejection' as const,
      findings: [
        {
          owner: 'owner',
          criterion: 'original-criterion',
          reason: 'Reviewed context A is lost',
          evidence: [
            this.task.store(
              'independent-review.md',
              'Independent rejection A\nKeep the exact originating finding.\n',
            ),
          ],
        },
        {
          owner: 'other',
          criterion: 'foreign-criterion',
          reason: 'Distinct independent finding B',
          evidence: [this.task.store('foreign-review.md', 'Independent rejection B\n')],
        },
      ],
    };
  }

  /** Commit explicit source and a declared operation that can execute inside production confinement. */
  private source() {
    git(this.root, 'init', '-b', 'staging');
    git(this.root, 'config', 'user.name', 'Hold fixture');
    git(this.root, 'config', 'user.email', 'hold@example.invalid');
    git(this.root, 'remote', 'add', 'origin', remote);
    const command = join(this.root, '.git', 'reviewed-command.mjs');
    copyFileSync(process.execPath, this.interpreter);
    writeFileSync(
      command,
      readFileSync(join(import.meta.dirname, 'reviewed-hold-command.js'), 'utf8'),
    );
    writeFileSync(join(this.root, '.git', 'diagnostic'), 'Error: reviewed behavior still fails');
    const files = {
      ...holdFiles,
      '.arc/architecture/operations/owner-tests.yaml': JSON.stringify({
        id: 'owner-tests',
        category: 'test',
        command: this.interpreter,
        args: [command, 'fixture.txt', '', join(this.root, '.git', 'diagnostic')],
        network: false,
      }),
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      writeFileSync(join(this.root, path), content);
    }
    git(this.root, 'add', '.');
    git(this.root, 'commit', '-m', 'Explicit Workflow hold fixture');
  }

  /** Admit a real journal and control only remote transport before Workflow binds actor responses. */
  private open(t: TestContext) {
    const capture = new Architecture().capture(this.root);
    const journal = new Coordination(this.storage).admit(remote, focus.purpose);
    assert(journal instanceof Journal);
    const task = new HostTask(
      {
        capture,
        common: join(this.root, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      focus.purpose,
      journal,
    );
    const provider = new GitHub(remote, signal);
    t.mock.method(provider, 'remoteHead', async () => this.head);
    t.mock.method(provider, 'publication', async () => undefined);
    t.mock.method(provider, 'push', async (_root: string, _branch: string, head: string) => {
      this.head = head;
    });
    t.mock.method(task, 'provider', () => provider);
    return task;
  }

  /** Persist an independent verdict and its Direction revision using production event shapes. */
  private recordReview() {
    const original = { ...correction, id: 'original' };
    const digest = git(this.root, 'rev-parse', 'HEAD^{tree}');
    const foreign = {
      ...original,
      id: 'foreign',
      owner: 'other',
      criteria: [{ id: 'foreign-criterion', description: 'Preserve the external schema' }],
    };
    const plan: Plan = { focus, milestones: [original, foreign] };
    this.task.record({ plan });
    this.task.record({
      candidate: { digest, evidence: [] },
      verdict: { kind: 'rejected', candidate: digest, findings: this.rejection.findings },
    });
    this.task.record({ feedback: this.rejection });
    this.task.record({ plan: { focus, milestones: [correction, ...plan.milestones] } });
    this.task.record({ position: { completed: 0, activities: { [correction.id]: 2 } } });
  }

  /** Secure original answers and an acknowledged receipt before the first held check. */
  async prepare() {
    await this.task.setupWorkspace('699', signal);
    this.task.ask = async () => answer;
    await new Clarifications(this.task, selection, signal).decide(
      { milestone: { id: correction.id }, acceptance: correction.criteria },
      question,
    );
    await this.edit('unrelated.txt', 'acknowledged before hold');
  }

  /** Secure one acknowledged file using the actual checked-edit/checkpoint boundary. */
  async edit(path: string, content: string) {
    const expected = textDigest(readFileSync(join(this.task.worktree!, path), 'utf8'));
    const tools = new ActivationTools(
      this.task,
      selection,
      { milestone: { id: correction.id }, acceptance: correction.criteria },
      signal,
    );
    const receipt = await tools.invoke(
      { name: 'checked-edit', handler: 'edit' },
      { path, expected, content },
    );
    this.receipts.push(receipt);
    return receipt;
  }

  /** Produce a host hold through the public Execution steward boundary, never a model blocked claim. */
  run(): Promise<ActivityOutcome> {
    return steward(new Agent(new Architecture()), this.task, correction, 'implementation', signal);
  }

  /**
   * Refresh an external command input so production checks execute instead of reusing cached evidence.
   * Neither captured source, acceptance nor secured bytes change; equivalent output still must stop.
   */
  reobserve(diagnostic: string) {
    writeFileSync(join(this.root, '.git', 'diagnostic'), diagnostic);
    unlinkSync(this.interpreter);
    copyFileSync(process.execPath, this.interpreter);
  }

  /** Read secured checkpoint identity directly from Git. */
  checkpoint() {
    return git(this.task.worktree!, 'rev-parse', 'HEAD');
  }
}
