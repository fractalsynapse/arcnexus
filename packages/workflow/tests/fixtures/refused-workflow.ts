import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { direct, type Milestone, type RevisionRequest } from '../../../direction/src/index.js';
import { HostTask, steward, type HoldContext } from '../../../execution/src/index.js';
import { checkpoint } from '../../../execution/src/checkpoint.js';
import { git } from '../../../execution/src/git.js';
import { correction } from '../../../execution/tests/fixtures/reviewed-hold.js';
import { Workflow, type TaskObserver, type WorkflowServices } from '../../src/index.js';
import { ReviewedTask } from './reviewed-task.js';

const signal = new AbortController().signal;

/** Exercise actual rejection-to-refusal progression with real journal, Git and checked edits. */
export class RefusedWorkflow {
  readonly fixture: ReviewedTask;
  readonly calls: string[] = [];
  readonly revisions: RevisionRequest[] = [];
  readonly holds: HoldContext[] = [];
  readonly services: WorkflowServices;
  private readonly agent = new Agent(new Architecture());
  private head?: string;

  /** Start without a seeded verdict; Workflow must obtain its first rejection from assessment. */
  constructor(private readonly t: TestContext) {
    this.fixture = new ReviewedTask(t, false);
    this.services = this.providers();
  }

  /** Secure knowledge and a receipt before executing the original milestone and independent review. */
  async prepare() {
    await this.fixture.prepare();
    this.head = this.fixture.checkpoint();
    this.bind();
  }

  /** Bind only model responses and remote transport while retaining host effects and decoding. */
  private bind() {
    const task = this.fixture.task;
    const provider = task.provider(signal);
    this.t.mock.method(provider, 'remoteHead', async () => this.head);
    this.t.mock.method(provider, 'push', async (_root: string, _branch: string, head: string) => {
      this.head = head;
    });
    this.t.mock.method(provider, 'publication', async () => undefined);
    this.t.mock.method(task, 'provider', () => provider);
    this.t.mock.method(task, 'activate', async (_agent: Agent, _selection: unknown, data: TaskContext) =>
      this.reply(data),
    );
    const close = task.close.bind(task);
    let closed = false;
    this.t.mock.method(task, 'close', () => {
      if (closed) return;
      closed = true;
      close();
    });
  }

  /** Supply a native revision or repeat a genuinely unauthorized edit until Execution retains its hold. */
  private reply(data: TaskContext): unknown {
    const request = (data.assignment as { revisionContext?: RevisionRequest }).revisionContext;
    if (request) return this.proposal(request);
    return {
      kind: 'completed',
      edits: this.revisions.length === 1
        ? [{ path: 'schema.txt', expected: null, content: 'unauthorized' }]
        : [],
      checks: [],
    };
  }

  /** Retain the original criterion while placing runnable correction before its held requester. */
  private proposal(request: RevisionRequest) {
    this.revisions.push(request);
    this.calls.push(request.finding.kind === 'rejection' ? 'Direction:rejection' : 'Direction:hold');
    const accepted = JSON.parse(this.fixture.task.readFile(request.acceptedPlan).text);
    const pending = accepted.milestones.slice(request.position.completed).map((m: Milestone) => ({
      id: m.id,
      steps: m.steps.slice(request.position.activities[m.id] ?? 0),
    }));
    const contribution = request.finding.kind === 'rejection'
      ? correction
      : { ...correction, id: 'refusal-correction' };
    return { kind: 'plan', plan: { milestones: [contribution, ...pending] } };
  }

  /** Compose the public lifecycle with native Direction, real Execution and controlled final verdicts. */
  private providers(): WorkflowServices {
    return {
      execution: {
        admit: async () => this.fixture.task,
        checkpoint: async (_session, record, abort) => checkpoint(this.fixture.task, record, abort),
        assemble: async () => ({
          digest: git(this.fixture.task.worktree!, 'rev-parse', 'HEAD^{tree}'),
          evidence: [],
        }),
      },
      direction: {
        plan: async () => ({
          focus: { purpose: 'Recover refused correction', objectives: [], constraints: [] },
          milestones: [{ ...correction, id: 'original' }],
        }),
        revise: async (session, plan, feedback, abort) =>
          direct(this.agent, session, abort, { plan, feedback }),
      },
      agent: { execute: async (_session, milestone) => this.execute(milestone) },
      verification: { assess: async (_session, plan, candidate) => this.assess(plan, candidate.digest) },
      delivery: {
        integrate: async () => {
          this.calls.push('Delivery');
          return { kind: 'merged', commit: 'controlled-staging', evidence: [] };
        },
      },
    };
  }

  /** Reject the initial public assessment and accept only corrected bytes under original acceptance. */
  private assess(plan: import('../../../direction/src/index.js').Plan, digest: string) {
    this.calls.push('Review');
    for (const milestone of plan.milestones) assert.deepEqual(milestone.criteria, correction.criteria);
    if (!this.revisions.length) return {
      kind: 'rejected' as const,
      candidate: digest,
      findings: [this.fixture.rejection.findings[0]!],
    };
    assert.equal(this.fixture.task.readFile('fixture.txt').text, 'corrected');
    return {
      kind: 'accepted' as const,
      candidate: digest,
      criteria: ['original-criterion'],
      evidence: [],
    };
  }

  /** Let the original contribution reach review, then obtain actual steward refusal and correction. */
  private async execute(milestone: Milestone) {
    this.calls.push(milestone.id);
    if (milestone.id === 'original') return { kind: 'completed' as const, evidence: [] };
    if (milestone.id === 'refusal-correction') {
      await this.fixture.edit('fixture.txt', 'corrected');
      return { kind: 'completed' as const, evidence: [] };
    }
    const result = await steward(this.agent, this.fixture.task, milestone, 'implementation', signal);
    if (result.holdContext) this.holds.push(result.holdContext);
    return result;
  }

  /** Invoke Workflow with an optional interruption at its actual committed observation boundary. */
  run(observer: TaskObserver = { progress() {} }) {
    return new Workflow(this.services).run(
      { directory: this.fixture.root, goal: this.fixture.task.goal }, observer, signal,
    );
  }

  /** Reopen the retained task without changing its plan, answers, receipts or cursor. */
  async reopen() {
    const old = this.fixture.task;
    const journal = new Coordination(this.fixture.storage).admit(old.capture.source.remote, old.goal);
    assert(journal instanceof Journal);
    this.fixture.task = new HostTask(old.config, old.goal, journal);
    this.bind();
    await this.fixture.task.setupWorkspace('699', signal);
    assert.equal(this.fixture.task.taskID, old.taskID);
  }
}
