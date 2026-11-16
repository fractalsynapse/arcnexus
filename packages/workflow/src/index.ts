import type { Context } from 'cordis';
import {
  validateCorrection,
  validatePlan,
  validateRevision,
  type DirectionResult,
  type Feedback,
  type Milestone,
  type Plan,
} from '../../direction/src/index.js';
import { validateVerdict } from '../../verification/src/index.js';
import type {
  Observation,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

export type {
  ActivityOutcome,
  Observation,
  TaskEvent,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

declare module 'cordis' {
  interface Context {
    workflow: Workflow;
  }
}

type Interrupted = Extract<TaskOutcome, { reason: string }>;

/** Advance one admitted workflow and record observations through the task services. */
export class Workflow {
  /** Use the execution, direction, agent, verification and delivery services supplied by the app. */
  constructor(private readonly services?: WorkflowServices) {}

  /** Admit the goal, run the sequential loop and retain one terminal outcome. */
  async run(input: TaskInput, observer: TaskObserver, signal: AbortSignal): Promise<TaskOutcome> {
    if (!input.goal.trim()) return stopped('invalid', 'A task goal is required');
    if (signal.aborted) return stopped('cancelled', 'Task cancelled before admission');
    if (!this.services)
      return stopped('invalid', 'Task execution services are unavailable in this build');
    let session: TaskSession | undefined;
    let run: TaskRun | undefined;
    let outcome: TaskOutcome;
    try {
      const admitted = await this.services.execution.admit(input, signal);
      if ('kind' in admitted) return admitted;
      session = admitted;
      run = new TaskRun(this.services, session, observer, signal);
      outcome = await run.execute();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = stopped(signal.aborted ? 'cancelled' : 'failed', message, run?.evidence);
    }
    try {
      session?.finish(outcome);
      return outcome;
    } finally {
      session?.close();
    }
  }
}

/** Keep only the live cursor for one task. The supplied session persists accepted decisions. */
class TaskRun {
  readonly evidence: string[] = [];
  private plan?: Plan;
  private completed = 0;
  private readonly activityPositions = new Map<string, number>();
  private readonly rejectedCandidates = new Set<string>();

  /** Bind this invocation to one admitted session and cancellation signal. */
  constructor(
    private readonly services: WorkflowServices,
    private readonly session: TaskSession,
    private readonly observer: TaskObserver,
    private readonly signal: AbortSignal,
  ) {}

  /** Execute accepted milestones, re-plan on feedback and publish only an accepted candidate. */
  async execute(): Promise<TaskOutcome> {
    const resumed = await this.services.delivery.resume?.(this.session, this.signal, (event) =>
      this.report(event),
    );
    if (resumed) return resumed;
    this.report({ phase: 'planning', message: 'Director is planning the goal' });
    const initial = await this.services.direction.plan(this.session, this.signal);
    const blocked = await this.acceptPlan(initial);
    if (blocked) return blocked;
    while (true) {
      this.signal.throwIfAborted();
      const plan = this.plan!;
      const milestone = plan.milestones[this.completed];
      if (milestone) {
        const interrupted = await this.executeMilestone(milestone);
        if (interrupted) return interrupted;
        continue;
      }
      const result = await this.review(plan);
      if (result) return result;
    }
  }

  /** Persist a checkpoint before exposing it to the observer. */
  private report(observation: Observation) {
    if (observation.evidence) this.evidence.push(...observation.evidence);
    this.session.record(observation);
    this.observer.progress(observation);
    this.signal.throwIfAborted();
  }

  /** Keep the prior cursor when Direction needs a human answer or a validated plan revision. */
  private async acceptPlan(
    result: DirectionResult,
    reason?: Feedback,
  ): Promise<Interrupted | undefined> {
    while (result.kind === 'question') {
      const feedback = await this.answer(result);
      if ('reason' in feedback) return feedback;
      this.session.record({ feedback });
      result = await this.services.direction.revise(this.session, this.plan, feedback, this.signal);
    }
    this.signal.throwIfAborted();
    validatePlan(this.session.capture, result.plan);
    if (this.plan) validateRevision(this.plan, result.plan, this.completed, this.activityPositions);
    if (reason?.kind === 'rejection')
      validateCorrection(result.plan, this.completed, reason.findings);
    this.plan = result.plan;
    this.session.record({ plan: result.plan });
  }

  /** Translate an unanswered genuine gate into a retained blocked outcome. */
  private async answer(
    question: Extract<DirectionResult, { kind: 'question' }>,
  ): Promise<(Feedback & { kind: 'answer' }) | Interrupted> {
    this.report({ phase: 'question', message: question.question, evidence: question.evidence });
    const answer = await this.observer.answer?.(question.question, this.signal);
    this.signal.throwIfAborted();
    return answer?.trim()
      ? { kind: 'answer', question: question.question, answer, evidence: question.evidence }
      : stopped('blocked', question.question, question.evidence);
  }

  /** Preserve progress recorded before a supplier request or other interruption. */
  private async executeMilestone(milestone: Milestone): Promise<Interrupted | undefined> {
    const start = this.activityPositions.get(milestone.id) ?? 0;
    for (const [index, step] of milestone.steps.entries()) {
      if (index < start || step.inapplicable || step.activity === 'release') continue;
      this.signal.throwIfAborted();
      const outcome = await this.activate(milestone, step.activity);
      this.signal.throwIfAborted();
      if (outcome.kind === 'blocked') return stopped('blocked', outcome.reason, outcome.evidence);
      if (outcome.kind === 'question') {
        const feedback = await this.answer(outcome);
        return 'reason' in feedback ? feedback : this.revise(feedback);
      }
      if (outcome.kind === 'supplier') return this.revise(outcome);
      this.report({
        phase: 'activity',
        message: `Completed ${step.activity}`,
        evidence: outcome.evidence,
      });
      this.activityPositions.set(milestone.id, index + 1);
      this.recordPosition();
    }
    this.completed++;
    this.recordPosition();
  }

  /** Report the selected activity before starting the next scoped Agent activation. */
  private activate(
    milestone: Milestone,
    activity: Exclude<Milestone['steps'][number]['activity'], 'release'>,
  ) {
    this.report({ phase: 'activity', message: `${milestone.owner}/${activity} (${milestone.id})` });
    return this.services.agent.execute(this.session, milestone, activity, this.signal);
  }

  /** Persist Director feedback and accept its new sequence before any further activation. */
  private async revise(feedback: Feedback) {
    this.session.record({ feedback });
    this.report({
      phase: 'planning',
      message: `Director is considering ${feedback.kind} feedback`,
    });
    const revised = await this.services.direction.revise(
      this.session,
      this.plan,
      feedback,
      this.signal,
    );
    return this.acceptPlan(revised, feedback);
  }

  /** Evaluate one assembled candidate and keep a rejected candidate out of delivery. */
  private async review(plan: Plan): Promise<TaskOutcome | undefined> {
    this.report({
      phase: 'verification',
      message: 'Assembling the candidate for independent review',
    });
    const candidate = await this.services.execution.assemble(this.session, this.signal);
    this.signal.throwIfAborted();
    if (this.rejectedCandidates.has(candidate.digest))
      throw new Error('Correction produced an already rejected candidate');
    const verdict = await this.services.verification.assess(
      this.session,
      plan,
      candidate,
      this.signal,
    );
    this.signal.throwIfAborted();
    validateVerdict(plan, candidate, verdict);
    this.session.record({ candidate, verdict });
    if (verdict.kind === 'blocked') return stopped('blocked', verdict.reason, verdict.evidence);
    if (verdict.kind === 'rejected') return this.correct(candidate.digest, verdict.findings);
    this.report({
      phase: 'delivery',
      message: 'Reviewer accepted the candidate',
      evidence: verdict.evidence,
    });
    return this.services.delivery.integrate(this.session, candidate, verdict, this.signal);
  }

  /** Hold delivery and route criterion-linked rejection evidence to Direction. */
  private async correct(
    digest: string,
    findings: Extract<Feedback, { kind: 'rejection' }>['findings'],
  ) {
    this.rejectedCandidates.add(digest);
    this.report({
      phase: 'verification',
      message: 'Reviewer rejected criteria',
      evidence: findings.flatMap((finding) => finding.evidence),
    });
    return this.revise({ kind: 'rejection', findings });
  }

  /** Preserve the plan and live cursor for later observations. */
  private recordPosition() {
    this.session.record({
      position: {
        completed: this.completed,
        activities: Object.fromEntries(this.activityPositions),
      },
    });
  }
}

/** Make an explicit outcome for a held gate, failed run or invalid admission. */
function stopped(
  kind: Interrupted['kind'],
  reason: string,
  evidence: readonly string[] = [],
): Interrupted {
  return { kind, reason, evidence };
}

/** Mount the same Workflow service for the CLI and other adapters. */
export function workflowPlugin(services?: WorkflowServices) {
  return (context: Context) => {
    context.provide('workflow', new Workflow(services));
  };
}
