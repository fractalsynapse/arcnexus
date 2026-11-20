import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type Capture, type TaskContext } from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import {
  activities,
  track,
  type Plan,
  type StewardCheckFailure,
} from '../../../direction/src/index.js';
import { Workflow, type TaskEvent, type WorkflowServices } from '../../../workflow/src/index.js';
import { Execution, HostTask, steward } from '../../src/index.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const remote = 'https://github.com/fixture/interrupted-check.git';
const criterion = { id: 'fixed', description: 'The checked contribution survives restart' };
const agent = new Agent(new Architecture());
const plan: Plan = {
  focus: {
    purpose: 'Recover an interrupted steward check',
    objectives: ['Retain edits, check results and activity position'],
    constraints: ['Reuse the issue and branch'],
  },
  milestones: [
    {
      id: 'repair',
      owner: 'owner',
      criteria: [criterion],
      steps: activities.map((activity) => ({
        activity,
        ...(['implementation', 'review'].includes(activity)
          ? {
              checklist: [
                { id: activity, criteria: [criterion.id], expected: 'Retain the repair' },
              ],
            }
          : { checklist: [], inapplicable: 'Outside this fixture' }),
      })),
    },
  ],
};

/** Model only Collaboration; Git commits, journals and worktrees remain real. */
class CheckRemote extends GitHub {
  head?: string;
  issues = 0;
  verified = 0;

  /** Bind an isolated provider without contacting GitHub. */
  constructor() {
    super(remote, new AbortController().signal);
  }

  /** Report that initial issue discovery found no existing issue. */
  override async findIssue() {
    return undefined;
  }

  /** Count issue creation so retries cannot silently allocate another issue. */
  override async issue() {
    this.issues++;
    return '7';
  }

  /** Verify the retained issue identity on every retry. */
  override async verifyIssue(issue: string) {
    assert.equal(issue, '7');
    this.verified++;
  }

  /** Keep this fixture before pull request publication. */
  override async publication() {
    return undefined;
  }

  /** Expose the checkpoint that the simulated provider has accepted. */
  override async remoteHead() {
    return this.head;
  }

  /** Require the observed lease and preserve the same issue branch. */
  override async push(_root: string, branch: string, head: string, previous?: string) {
    assert.equal(branch, '7-task');
    assert.equal(previous, this.head);
    this.head = head;
  }
}

/** Exercise interruption through the real steward, Workflow, Coordination and Execution lifecycle. */
class InterruptedCheck {
  readonly provider = new CheckRemote();
  readonly activations: string[] = [];
  readonly checks: { status: number; log: string }[] = [];
  readonly recovered: (StewardCheckFailure | undefined)[] = [];
  readonly gates: string[] = [];
  beforeRetry: readonly TaskEvent[] = [];
  private readonly root: string;
  private readonly storage: string;
  private readonly capture: Capture;
  private readonly services: WorkflowServices;
  private controller = new AbortController();
  private phase: 'interrupt' | 'repeat' | 'correct' | 'resume' = 'interrupt';
  private task?: HostTask;
  private plans = 0;

  /** Create isolated local Git and SQLite state; no native confinement claim is made. */
  constructor(
    private readonly t: TestContext,
    readonly expected: 'pass' | 'fail',
  ) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-interrupted-check-'));
    this.root = join(directory, 'project');
    this.storage = join(directory, 'state');
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    this.capture = this.source();
    this.services = this.compose();
  }

  /** Reopen the same logical task with a fresh cancellation signal. */
  run(phase: typeof this.phase) {
    this.phase = phase;
    this.controller = new AbortController();
    return new Workflow(this.services).run(
      { directory: this.root, goal: 'Recover the interrupted check' },
      { progress() {} },
      this.controller.signal,
    );
  }

  /** Prove that cleanup secured the checked bytes on the issue branch before removing its worktree. */
  secured(contents: string) {
    assert(this.task);
    assert.equal(this.task.worktree, undefined);
    assert.equal(this.git('show', '7-task:fixture.txt'), contents);
    assert.equal(this.git('worktree', 'list', '--porcelain').split('worktree ').length, 2);
    assert(!existsSync(join(this.root, 'fixture.txt')));
    assert.equal(this.provider.issues, 1);
    assert.equal(this.plans, 1);
    for (const { status, log } of this.checks)
      assert.equal(readFileSync(log, 'utf8'), `fixture diagnostic: exit ${status}\n`);
  }

  /** Compose production lifecycle ports while controlling model and operation outcomes. */
  private compose(): WorkflowServices {
    const coordination = new Coordination(this.storage);
    const execution = new Execution(new Architecture(), coordination, this.storage);
    return {
      execution: {
        admit: async ({ goal }) => this.admit(coordination, goal),
        prepare: (session, issue, signal) => execution.prepare(session, issue, signal),
        assemble: (session, signal) => execution.assemble(session, signal),
        checkpoint: async (session, activity, signal) => {
          await execution.checkpoint(session, activity, signal);
          if (this.phase === 'correct' && activity.outcome.kind === 'completed')
            this.controller.abort(new Error('Interrupted after completed checkpoint'));
        },
      },
      direction: {
        track,
        plan: async () => {
          this.plans++;
          return { kind: 'plan', plan };
        },
        revise: async () => assert.fail('A retained recheck must not be lost or replanned'),
      },
      agent: {
        execute: (session, selected, activity, signal) =>
          steward(agent, session, selected, activity, signal),
      },
      ...this.reviewGates(),
    };
  }

  /** Keep independent acceptance ahead of delivery and observe both gates. */
  private reviewGates(): Pick<WorkflowServices, 'verification' | 'delivery'> {
    return {
      verification: {
        assess: async (_session, _plan, candidate) => {
          this.gates.push('verification');
          return {
            kind: 'accepted',
            candidate: candidate.digest,
            criteria: [criterion.id],
            evidence: [],
          };
        },
      },
      delivery: {
        integrate: async (_session, candidate, verdict) => {
          assert.deepEqual(this.gates, ['verification']);
          assert.equal(verdict.candidate, candidate.digest);
          this.gates.push('delivery');
          return { kind: 'merged', commit: candidate.digest, evidence: [] };
        },
      },
    };
  }

  /** Claim a new attempt through durable Coordination rather than reusing a closed HostTask. */
  private admit(coordination: Coordination, goal: string) {
    const journal = coordination.admit(remote, goal);
    assert('record' in journal);
    const task = new HostTask(
      {
        capture: this.capture,
        common: join(this.root, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      goal,
      journal,
    );
    this.task = task;
    if (this.phase === 'repeat') this.beforeRetry = task.history();
    this.bind(task);
    return task;
  }

  /** Replace only the external harness and command boundary, retaining native journal events. */
  private bind(task: HostTask) {
    this.t.mock.method(task, 'provider', () => this.provider);
    this.t.mock.method(task, 'check', async (id: string, _signal: AbortSignal, scope: unknown) =>
      this.observeCheck(task, id, scope),
    );
    this.t.mock.method(
      task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.proposal(task, data),
    );
  }

  /** Record the exact exit and readable evidence, then interrupt before steward feedback exists. */
  private observeCheck(task: HostTask, id: string, scope: unknown) {
    assert.equal(id, 'owner-tests');
    assert(task.worktree);
    const status = this.checkStatus(task);
    const log = task.store('owner-tests.log', `fixture diagnostic: exit ${status}\n`);
    const check = {
      id,
      status,
      command: 'fixture-check',
      args: [],
      cwd: task.worktree,
      durationMs: 1,
      log,
    };
    task.note({ check, scope });
    this.checks.push({ status, log });
    if (this.phase === 'interrupt') this.interruptAfterObservation();
    return check;
  }

  /** Derive the fixture's exact exit from its bytes and retry phase. */
  private checkStatus(task: HostTask): number {
    const corrected = readFileSync(join(task.worktree!, 'fixture.txt'), 'utf8') === 'corrected';
    if (corrected) return this.expected === 'pass' ? 0 : 37;
    if (this.expected === 'fail') return 0;
    return this.phase === 'interrupt' ? 37 : 43;
  }

  /** Cancel only after the native task journal has retained the check observation. */
  private interruptAfterObservation(): void {
    this.controller.abort(new Error('Interrupted after check record, before feedback'));
  }

  /** Route review separately and retain the original checked contribution on interruption. */
  private proposal(task: HostTask, data: TaskContext) {
    assert(task.worktree);
    assert.equal(task.branch, '7-task');
    assert.equal(this.git('worktree', 'list', '--porcelain').split('worktree ').length, 3);
    const review = JSON.stringify(data.milestone).includes('"activity":"review"');
    this.activations.push(review ? 'review' : 'implementation');
    if (review) return { kind: 'completed', edits: [], checks: [] };
    if (this.phase !== 'interrupt') return this.retryProposal(task, data);
    return {
      kind: 'completed',
      edits: [{ path: 'fixture.txt', expected: null, content: 'checked' }],
      checks: [{ id: 'owner-tests', expected: this.expected }],
    };
  }

  /** Observe recovered bytes and diagnostic context before proposing an optional checked correction. */
  private retryProposal(task: HostTask, data: TaskContext) {
    assert(task.worktree);
    assert.equal(readFileSync(join(task.worktree, 'fixture.txt'), 'utf8'), 'checked');
    const pending = task.pendingCheck({ owner: 'owner', activity: 'implementation' });
    this.recovered.push(pending);
    if (pending) this.assertRecoveredFailure(data, pending);
    return { kind: 'completed', edits: this.correctionEdits(), checks: [] };
  }

  /** Confirm recovery retains the failed check's authority, exact exit and readable log. */
  private assertRecoveredFailure(data: TaskContext, pending: StewardCheckFailure): void {
    const assignment = data.assignment as { failedCheck?: StewardCheckFailure };
    assert.deepEqual(assignment.failedCheck, pending);
    assert(data.evidence?.includes(pending.log));
    assert.equal(readFileSync(pending.log, 'utf8'), `fixture diagnostic: exit ${pending.status}\n`);
  }

  /** Correct the retained bytes only in the correction phase using their observed digest. */
  private correctionEdits() {
    if (this.phase !== 'correct') return [];
    return [
      {
        path: 'fixture.txt',
        expected: createHash('sha256').update('checked').digest('hex'),
        content: 'corrected',
      },
    ];
  }

  /** Initialize a real Git base and the captured authority for the fixture's single owned path. */
  private source(): Capture {
    mkdirSync(this.root);
    this.git('init');
    this.git('config', 'user.name', 'ArcNexus Fixture');
    this.git('config', 'user.email', 'arcnexus@example.invalid');
    writeFileSync(join(this.root, 'base.txt'), 'base');
    this.git('add', '.');
    this.git('commit', '-m', 'base');
    return {
      source: { root: this.root, remote, revision: this.git('rev-parse', 'HEAD') },
      project: { contractRegistry: 'registry.yaml' },
      contracts: [],
      components: {
        owner: {
          id: 'owner',
          owns: ['fixture.txt'],
          activities: {
            implementation: { profile: 'fixture', operations: ['owner-tests'] },
            review: { profile: 'fixture', operations: [] },
          },
        },
      },
    } as unknown as Capture;
  }

  /** Execute local Git commands without reaching a live remote. */
  private git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: this.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
}

/** Establish the exact interruption boundary without manufacturing supplier feedback. */
async function interrupt(scenario: InterruptedCheck) {
  const outcome = await scenario.run('interrupt');
  assert.equal(outcome.kind, 'cancelled', JSON.stringify(outcome));
  assert.match(outcome.reason, /Interrupted after check record, before feedback/);
  assert.deepEqual(scenario.activations, ['implementation']);
  assert.deepEqual(scenario.gates, []);
  assert.equal(scenario.checks.length, 1);
  assert.equal(scenario.checks[0]!.status, scenario.expected === 'pass' ? 37 : 0);
  scenario.secured('checked');
}

for (const expected of ['pass', 'fail'] as const) {
  test(`interrupted ${expected} check recovers its expectation, exact exit, evidence and edits`, async (t) => {
    const scenario = new InterruptedCheck(t, expected);
    await interrupt(scenario);
    await scenario.run('repeat');
    assert.equal(
      scenario.beforeRetry.some((event) => 'feedback' in event),
      false,
    );
    const first = scenario.checks[0]!;
    assert.deepEqual(scenario.recovered[0], {
      id: 'owner-tests',
      expected,
      status: first.status,
      log: first.log,
      activity: 'implementation',
    });
    scenario.secured('checked');
  });

  test(`omitted ${expected} recheck blocks on repeat failure and resumes after corrected checkpoint`, async (t) => {
    const scenario = new InterruptedCheck(t, expected);
    await interrupt(scenario);
    const repeated = await scenario.run('repeat');
    assert.equal(repeated.kind, 'blocked', JSON.stringify(repeated));
    const repeatedStatus = expected === 'pass' ? 43 : 0;
    assert.match(repeated.reason, new RegExp(`owner-tests.*${repeatedStatus}`));
    assert.deepEqual(
      scenario.checks.map(({ status }) => status),
      [expected === 'pass' ? 37 : 0, repeatedStatus],
    );
    assert(repeated.evidence.includes(scenario.checks[0]!.log));
    assert(repeated.evidence.includes(scenario.checks[1]!.log));
    assert.deepEqual(scenario.gates, []);
    scenario.secured('checked');
    const corrected = await scenario.run('correct');
    assert.equal(corrected.kind, 'cancelled', JSON.stringify(corrected));
    assert.equal(scenario.checks.at(-1)!.status, expected === 'pass' ? 0 : 37);
    scenario.secured('corrected');
    const before = scenario.activations.slice();
    assert.equal((await scenario.run('resume')).kind, 'merged');
    assert.deepEqual(scenario.activations, [...before, 'review']);
    assert.equal(scenario.checks.length, 3);
    assert.deepEqual(scenario.gates, ['verification', 'delivery']);
    assert.equal(scenario.provider.verified, 3);
    scenario.secured('corrected');
  });
}
