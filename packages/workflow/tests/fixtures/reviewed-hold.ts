import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Candidate } from '../../../verification/src/index.js';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import {
  direct,
  type Feedback,
  type Milestone,
  type Plan,
  type RevisionRequest,
} from '../../../direction/src/index.js';
import {
  Clarifications,
  HostTask,
  steward,
  type HoldContext,
  type StewardOutcome,
} from '../../../execution/src/index.js';
import { ActivationTools } from '../../../execution/src/activation-tools.js';
import { checkpoint } from '../../../execution/src/checkpoint.js';
import { git } from '../../../execution/src/git.js';
import { execute } from '../../../execution/src/process.js';
import { textDigest } from '../../../foundation/src/index.js';
import {
  answer,
  correction,
  question,
  ReviewedHoldFixture,
  selection,
} from '../../../execution/tests/fixtures/reviewed-hold.js';
import { ReviewedTask } from './reviewed-task.js';
import {
  Workflow,
  type ActivityCheckpoint,
  type TaskObserver,
  type WorkflowServices,
} from '../../src/index.js';

export type Scenario = 'split' | 'repeat' | 'diagnostic' | 'progress' | 'human' | 'external';
export const gateQuestion = 'Approve the corrected schema architecture?';
export const gateAnswer =
  'Approve schema A.\n\nKeep the original criterion and captured ownership.';

/** Continue Execution's real rejected-task fixture through Workflow and native Direction reconstruction. */
export class ReviewedWorkflow {
  readonly fixture: ReviewedTask | ReviewedHoldFixture;
  readonly calls: string[] = [];
  readonly gateEvents: string[] = [];
  readonly holds: HoldContext[] = [];
  readonly revisions: unknown[] = [];
  readonly checkpoints: ActivityCheckpoint[] = [];
  readonly reviews: unknown[] = [];
  readonly services: WorkflowServices;
  diagnostic = 'Error: reviewed behavior still fails';
  private head?: string;
  private readonly agent = new Agent(new Architecture());
  private readonly signal = new AbortController().signal;

  /** Start at the retained rejected correction, with unaffected completed work before it. */
  constructor(
    private readonly t: TestContext,
    readonly scenario: Scenario,
    private readonly productionChecks = false,
  ) {
    this.fixture = productionChecks
      ? new ReviewedTask(t)
      : new ReviewedHoldFixture(t, scenario === 'external', 'arguments');
    const task = this.fixture.task;
    const prior = task.history().findLast((event) => 'plan' in event)!.plan!;
    const completed = prior.milestones.slice(1).map((milestone) => ({
      ...milestone,
      steps: milestone.steps.map((step) => ({
        ...step,
        checklist: step.checklist.map((item) => ({
          ...item,
          criteria: milestone.criteria.map((criterion) => criterion.id),
        })),
      })),
    }));
    task.record({ plan: { ...prior, milestones: [...completed, correction] } });
    task.record({ position: { completed: 2, activities: { [correction.id]: 2 } } });
    this.services = this.providers();
  }

  /** Produce the initial failing check and acknowledged receipt through the preceding Execution contribution. */
  async prepare() {
    await this.fixture.prepare();
    this.head = this.fixture.checkpoint();
    this.bind();
    await this.fixture.task.check('owner-tests', this.signal, {
      owner: 'owner',
      activity: 'implementation',
      expected: 'pass',
    });
  }

  /** Bind controlled model/transport collaborators while retaining actual decoding, commands and journal state. */
  private bind() {
    const task = this.fixture.task;
    this.bindClosure(task);
    const provider = task.provider(this.signal);
    this.t.mock.method(provider, 'remoteHead', async () => this.head);
    this.t.mock.method(provider, 'push', async (_root: string, _branch: string, head: string) => {
      this.head = head;
    });
    this.t.mock.method(provider, 'publication', async () => undefined);
    this.t.mock.method(task, 'provider', () => provider);
    this.t.mock.method(
      task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.reply(data),
    );
    this.t.mock.method(
      task,
      'check',
      async (id: string, signal: AbortSignal, scope?: Parameters<HostTask['check']>[2]) =>
        this.productionChecks
          ? this.productionCheck(id, signal, scope)
          : this.check(id, signal, scope),
    );
  }

  /** Let Workflow and the shared fixture each clean up while closing the real writer exactly once. */
  private bindClosure(task: HostTask) {
    const close = task.close.bind(task);
    let closed = false;
    this.t.mock.method(task, 'close', () => {
      if (closed) return;
      closed = true;
      close();
    });
  }

  /** Retain the actual production result without synthesizing ordinary failure diagnostics. */
  private async productionCheck(
    id: string,
    signal: AbortSignal,
    scope?: Parameters<HostTask['check']>[2],
  ) {
    const result = await HostTask.prototype.check.call(this.fixture.task, id, signal, scope);
    this.fixture.checks.push(result);
    return result;
  }

  /** Execute a real subprocess and persist its exact log, exit and relevant input identity. */
  private async check(id: string, signal: AbortSignal, scope?: Parameters<HostTask['check']>[2]) {
    const task = this.fixture.task;
    const log = task.artifact('reviewed-check.log');
    const args = [
      join(import.meta.dirname, 'reviewed-hold-command.js'),
      'fixture.txt',
      this.scenario === 'external' ? join(this.fixture.root, '.git', 'schema-ready') : '',
      this.diagnostic,
    ];
    const start = performance.now();
    const actual = await execute(process.execPath, args, { cwd: task.worktree!, log, signal });
    const check = {
      id,
      command: process.execPath,
      args,
      cwd: task.worktree!,
      log,
      status: actual.status,
      durationMs: performance.now() - start,
      ...(actual.status ? { diagnostic: actual.stderr.trim() } : {}),
      ...externalPrerequisite(this.scenario, this.fixture.root),
    };
    task.note({
      check,
      scope,
      checkInput: textDigest(readFileSync(join(task.worktree!, 'fixture.txt'), 'utf8')),
    });
    this.fixture.checks.push(check);
    if (this.scenario === 'external')
      this.gateEvents.push(
        check.prerequisite ? 'prerequisite-unavailable' : 'prerequisite-available',
      );
    return check;
  }

  /** Supply only provider responses; the native Director reconstructs and validates every pending proposal. */
  private async reply(data: TaskContext): Promise<unknown> {
    const assignment = data.assignment as { revisionContext?: RevisionRequest };
    if (assignment.revisionContext) return this.proposal(assignment.revisionContext);
    if (this.scenario === 'human') {
      const gates = new Clarifications(this.fixture.task, selection, this.signal);
      const context = { milestone: { id: correction.id }, acceptance: correction.criteria };
      return gates.run(context, async () =>
        gates.answers(context).some((gate) => gate.question === gateQuestion)
          ? { kind: 'completed', edits: [], checks: [] }
          : { kind: 'question', question: gateQuestion },
      );
    }
    return { kind: 'completed', edits: [], checks: [] };
  }

  /** Assert the exact retained handoff and return sequential contributions under original acceptance. */
  private proposal(request: RevisionRequest) {
    const task = this.fixture.task;
    this.revisions.push(request);
    this.calls.push('Direction');
    const held = this.holds.at(-1)!;
    assert(held, 'Direction received the actual Execution hold');
    const history = JSON.parse(task.readFile(request.retainedEvidence).text);
    assert(JSON.stringify(history).includes(held.failure.check?.log ?? held.failure.diagnostic));
    this.assertFeedback(request.finding);
    const accepted: Plan = JSON.parse(task.readFile(request.acceptedPlan).text);
    assert.deepEqual(
      accepted.milestones.find((m) => m.id === correction.id)!.criteria,
      correction.criteria,
    );
    const pending = accepted.milestones
      .slice(request.position.completed)
      .map((m) => ({ id: m.id, steps: m.steps.slice(request.position.activities[m.id] ?? 0) }));
    const parts =
      this.scenario === 'split' ? ['part-a', 'part-b'] : [`part-${this.revisions.length}`];
    return {
      kind: 'plan',
      plan: { milestones: [...parts.map((id) => ({ ...correction, id })), ...pending] },
    };
  }

  /** Compose real native revision and checkpoint boundaries with controlled independent assessment and delivery. */
  private providers(): WorkflowServices {
    return {
      execution: {
        admit: async () => this.fixture.task,
        checkpoint: async (_session, record, signal) => {
          await checkpoint(this.fixture.task, record, signal);
          this.checkpoints.push(record);
        },
        assemble: async () => this.assemble(),
      },
      direction: {
        plan: async () => {
          throw new Error('Retained plan must be reused');
        },
        revise: async (session, plan, feedback, signal) => {
          this.assertFeedback(feedback);
          return direct(this.agent, session, signal, { plan, feedback });
        },
      },
      agent: { execute: async (_session, milestone) => this.activate(milestone) },
      verification: { assess: async (_session, plan, candidate) => this.assess(plan, candidate) },
      delivery: {
        integrate: async () => {
          this.calls.push('Delivery');
          return { kind: 'merged', commit: 'controlled-staging', evidence: [] };
        },
      },
    };
  }

  /** Assess the actual assembled bytes and refreshed check against the original acceptance. */
  private async assess(plan: Plan, candidate: Candidate) {
    this.calls.push('Review');
    this.reviews.push({ plan, candidate });
    assert.deepEqual(
      plan.milestones.find((m) => m.id === correction.id)!.criteria,
      correction.criteria,
    );
    assert.equal(this.fixture.task.readFile('fixture.txt').text, 'corrected');
    assert.equal(this.fixture.checks.at(-1)!.status, 0);
    this.assertAssembledContinuity();
    return {
      kind: 'accepted' as const,
      candidate: candidate.digest,
      criteria: ['original-criterion', 'foreign-criterion'],
      evidence: [this.fixture.checks.at(-1)!.log],
    };
  }

  /** Require original knowledge and review artifacts to survive the entire correction sequence. */
  private assertAssembledContinuity() {
    const task = this.fixture.task;
    assert.deepEqual(
      new Clarifications(task, selection, this.signal)
        .answers({
          milestone: { id: correction.id },
          acceptance: correction.criteria,
        })
        .find((entry) => entry.question === question),
      { question, answer },
    );
    for (const finding of this.fixture.rejection.findings)
      for (const evidence of finding.evidence)
        assert(task.readFile(evidence).text.includes('Independent rejection'));
    assert.equal(task.issue, this.holds[0]!.task.issue);
    assert.equal(task.branch, this.holds[0]!.task.branch);
  }

  /** Require exact diagnostic, exit and evidence in Direction's structured feedback, not a generic blocked string. */
  private assertFeedback(feedback: Feedback) {
    const held = this.holds.at(-1)!;
    assert.equal(feedback.kind, 'supplier');
    assert(feedback.kind === 'supplier');
    assert.equal(feedback.owner, 'owner');
    assert.equal(feedback.requester, correction.id);
    assert.equal(feedback.reason, held.failure.diagnostic);
    if (held.failure.check) {
      const observed = held.failure.check;
      assert.deepEqual(feedback.failedCheck, {
        id: observed.id,
        activity: 'implementation',
        expected: 'pass',
        status: observed.status,
        log: observed.log,
        diagnostic: held.failure.diagnostic,
      });
      assert(feedback.evidence.includes(observed.log));
    }
  }

  /** Secure each smaller contribution before resuming its original rejected caller. */
  private async activate(milestone: Milestone): Promise<StewardOutcome> {
    this.calls.push(milestone.id);
    this.gateEvents.push('steward');
    if (milestone.id !== correction.id) return this.contribute(milestone);
    const result = await steward(
      this.agent,
      this.fixture.task,
      milestone,
      'implementation',
      this.signal,
    );
    if (result.holdContext) {
      this.assertHold(result.holdContext);
      this.holds.push(result.holdContext);
    }
    return result;
  }

  /** Give correction inputs distinguishable secured bytes; incidental writes cannot manufacture progress. */
  private async contribute(milestone: Milestone): Promise<StewardOutcome> {
    assert.deepEqual(milestone.criteria, correction.criteria);
    const prior = this.fixture.task
      .history()
      .findLast((event) => 'activation' in event && event.activation.milestone === 'part-a');
    if (milestone.id === 'part-b') {
      assert(prior && 'activation' in prior);
      assert.equal(prior.activation.milestone, 'part-a');
      assert.equal(prior.activation.outcome.kind, 'completed');
      assert(prior.activation.outcome.evidence.length);
      assert.equal(this.fixture.task.readFile('fixture.txt').text, 'partial-a');
    }
    const count = this.revisions.length;
    const progress = this.scenario === 'progress' && count < 3;
    const content =
      milestone.id === 'part-a' ? 'partial-a' : progress ? `partial-${count}` : 'corrected';
    const incidental =
      this.scenario === 'repeat' || (this.scenario === 'diagnostic' && count === 1);
    const path = incidental ? 'unrelated.txt' : 'fixture.txt';
    const receipt = await this.edit(milestone, path, content);
    const evidence = this.fixture.task.store(
      'contribution.json',
      JSON.stringify({ milestone: milestone.id, finding: this.holds[0]!.rejection, receipt }),
    );
    return { kind: 'completed', evidence: [evidence] };
  }

  /** Apply actual scoped checked edits and retain their receipts through Execution. */
  private async edit(milestone: Milestone, path: string, content: string) {
    const task = this.fixture.task;
    const tools = new ActivationTools(
      task,
      selection,
      { milestone: { id: milestone.id }, acceptance: milestone.criteria },
      this.signal,
    );
    return tools.invoke(
      { name: 'checked-edit', handler: 'edit' },
      { path, expected: task.readFile(path).sha256, content },
    );
  }

  /** Observe new checked progress through Execution before re-entering the retained Workflow cursor. */
  async recheck() {
    if (this.fixture instanceof ReviewedTask) this.fixture.reobserve(this.diagnostic);
    const tools = new ActivationTools(
      this.fixture.task,
      selection,
      { milestone: { id: correction.id }, acceptance: correction.criteria },
      this.signal,
    );
    await tools.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'pass' });
    return this.fixture.checks.at(-1)!;
  }

  /** Recheck the assembled secured tree immediately before the independent assessment boundary. */
  private async assemble() {
    const task = this.fixture.task;
    await task.check('owner-tests', this.signal, {
      owner: 'owner',
      activity: 'implementation',
      expected: 'pass',
    });
    return {
      digest: git(task.worktree!, 'rev-parse', 'HEAD^{tree}'),
      evidence: [this.fixture.checks.at(-1)!.log],
    };
  }

  /** Reject dropped acceptance, answers, checkpoint identities or originating findings at the consumer boundary. */
  private assertHold(held: HoldContext) {
    const task = this.fixture.task;
    assert.deepEqual(held.acceptance, correction.criteria);
    assert.deepEqual(held.rejection, this.fixture.rejection);
    assert.equal(held.task.id, task.taskID);
    assert.equal(held.task.issue, '699');
    assert.equal(held.task.branch, '699-task');
    assert.equal(held.task.checkpoint, this.fixture.checkpoint());
    assert.equal(held.answers.find((a) => a.question === question)?.answer, answer);
    assert(
      held.receipts.some((receipt) => JSON.stringify(this.fixture.receipts).includes(receipt.id)),
    );
  }

  /** Drive the public caller and retain terminal observations before real cleanup closes SQLite. */
  async run(observer: TaskObserver = { progress() {} }) {
    const result = await new Workflow(this.services).run(
      { directory: this.fixture.root, goal: this.fixture.task.goal },
      observer,
      this.signal,
    );
    return result;
  }

  /** Reopen the same durable task; no cursor, answer or checkpoint is repaired by the test. */
  async reopen(satisfied = false) {
    const old = this.fixture.task;
    const journal = new Coordination(this.fixture.storage).admit(
      old.capture.source.remote,
      old.goal,
    );
    assert(journal instanceof Journal);
    this.fixture.task = new HostTask(old.config, old.goal, journal);
    if (satisfied && this.scenario === 'external')
      writeFileSync(join(this.fixture.root, '.git', 'schema-ready'), 'approved external schema\n');
    this.bind();
    this.fixture.task.ask = async () => (satisfied ? gateAnswer : undefined);
    await this.fixture.task.setupWorkspace('699', this.signal);
    assert.equal(this.fixture.task.taskID, old.taskID);
  }
}

/** Observe the external artifact independently of model prose or a requested continuation. */
function externalPrerequisite(scenario: Scenario, root: string) {
  if (scenario !== 'external' || existsSync(join(root, '.git', 'schema-ready'))) return {};
  return {
    prerequisite: 'dependencies' as const,
    reason: 'Supply the approved external schema before correction.',
  };
}
