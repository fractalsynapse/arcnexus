import type { Context } from 'cordis';
import {
  decodeDirectorResponse,
  DirectorResponseError,
  scheduledSupplier,
  validateCorrection,
  validatePlan,
  validateRevision,
  type DirectionResult,
  type Feedback,
  type Milestone,
  type Plan,
  type RevisionFeedback,
  type StandingGoalEvidence,
} from '../../direction/src/index.js';
import { validateVerdict, type Candidate } from '../../verification/src/index.js';
import { interruptedRun, stopped, type Interrupted } from './services.js';
import type {
  ActivityCheckpoint,
  Observation,
  RoundOutcome,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

export type {
  ActivityCheckpoint,
  ActivityOutcome,
  GoalRound,
  RoundOutcome,
  StandingGoal,
  Observation,
  TaskEvent,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';
export { ClarificationRequired } from './services.js';

declare module 'cordis' {
  interface Context {
    workflow: Workflow;
  }
}

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
      run = new TaskRun(this.services, session, observer, signal, input.measureOwner);
      outcome = await run.execute();
    } catch (error) {
      outcome = interruptedRun(error, signal, run?.evidence);
    }
    try {
      outcome = this.finalize(session, outcome);
      session?.finish(outcome);
      return outcome;
    } finally {
      session?.close();
    }
  }

  /** Run one admitted task per goal, preserving the round identity when a goal stops. */
  async round(
    directory: string,
    observer: TaskObserver,
    signal: AbortSignal,
  ): Promise<RoundOutcome> {
    const round = this.services?.execution.round?.(directory);
    if (!round) throw new Error('Standing goal rounds are unavailable');
    const goals: RoundOutcome['goals'][number][] = [];
    for (const goal of round.goals) {
      if (signal.aborted) break;
      observer.progress({ phase: 'planning', message: `Round ${round.id} · ${goal.id}` });
      const outcome = await this.run(
        {
          directory,
          goal: goal.body,
          scope: `round:${round.id}:${goal.id}`,
          measureOwner: goal.owner,
        },
        observer,
        signal,
      );
      goals.push({ id: goal.id, outcome });
      if (outcome.kind !== 'merged' && outcome.kind !== 'satisfied') break;
    }
    const completed =
      goals.length === round.goals.length &&
      goals.every(({ outcome }) => outcome.kind === 'merged' || outcome.kind === 'satisfied');
    if (completed) round.finish();
    return { kind: 'round', round: round.id, completed, goals };
  }

  /** Keep the terminal record accurate if the host cannot safely remove its worktree. */
  private finalize(session: TaskSession | undefined, outcome: TaskOutcome): TaskOutcome {
    try {
      session?.cleanup?.();
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return stopped('failed', `Task workspace cleanup failed: ${message}`, outcome.evidence);
    }
  }
}

/** Keep only the live cursor for one task. The supplied session persists accepted decisions. */
class TaskRun {
  readonly evidence: string[] = [];
  private plan?: Plan;
  private standing?: StandingGoalEvidence;
  private completed = 0;
  private readonly activityPositions = new Map<string, number>();
  private readonly rejectedReviews = new Set<string>();

  /** Bind this invocation to one admitted session and cancellation signal. */
  constructor(
    private readonly services: WorkflowServices,
    private readonly session: TaskSession,
    private readonly observer: TaskObserver,
    private readonly signal: AbortSignal,
    private readonly measureOwner?: string,
  ) {}

  /** Execute accepted milestones, re-plan on feedback and publish only an accepted candidate. */
  async execute(): Promise<TaskOutcome> {
    this.session.ask = (question) => this.prompt(question);
    const resumed = await this.services.delivery.resume?.(this.session, this.signal, (event) =>
      this.report(event),
    );
    if (resumed) return resumed;
    const setup = await this.prepare();
    if (setup) return setup;
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

  /** Expose a native clarification gate through the same transport-neutral observer. */
  private prompt(question: string) {
    this.report({ phase: 'question', message: question });
    return this.observer.answer?.(question, this.signal) ?? Promise.resolve(undefined);
  }

  /** Restore an accepted plan or evaluate and plan fresh work before preparing the issue branch. */
  private async prepare(): Promise<TaskOutcome | undefined> {
    const saved = this.session.history?.() ?? [];
    this.plan = saved.findLast((event) => 'plan' in event)?.plan;
    if (!this.plan) {
      const planning = await this.startPlanning(saved);
      if (planning) return planning;
    }
    if (this.services.direction.track && this.services.execution.prepare) {
      const issue = await this.services.direction.track(this.session, this.signal);
      await this.services.execution.prepare(this.session, issue, this.signal);
    }
    return this.restore();
  }

  /** Give Direction the authored standing goal and measured staging context before admitting work. */
  private async startPlanning(saved: ReturnType<NonNullable<TaskSession['history']>>) {
    if (this.measureOwner) {
      const recorded = saved.findLast((event) => 'assessment' in event)?.assessment;
      if (recorded) return recorded;
      if (!this.services.execution.measureGoal)
        throw new Error('Standing goal measurement is unavailable in this build');
      this.standing = await this.services.execution.measureGoal(
        this.session,
        this.measureOwner,
        this.signal,
      );
    }
    this.report({
      phase: 'planning',
      message: this.standing
        ? 'Director is assessing the standing goal'
        : 'Director is planning the goal',
      evidence: this.standing ? [this.standing.log] : undefined,
    });
    return this.acceptPlan(() =>
      this.services.direction.plan(this.session, this.signal, this.standing),
    );
  }

  /** Read the durable cursor and handle an outcome observed just before interruption. */
  private async restore(): Promise<TaskOutcome | undefined> {
    const events = this.session.history?.() ?? [];
    const committed = events.findLastIndex((event) => 'position' in event);
    const position = events[committed];
    if (position && 'position' in position) {
      this.completed = position.position.completed;
      for (const [id, index] of Object.entries(position.position.activities))
        this.activityPositions.set(id, index);
    }
    const plan = events.findLastIndex((event) => 'plan' in event);
    const last = events.slice(Math.max(plan, committed) + 1);
    for (const event of events)
      if ('verdict' in event && event.verdict.kind === 'rejected')
        this.rejectedReviews.add(reviewKey(event.candidate));
    for (const event of last) {
      if ('verdict' in event && event.verdict.kind === 'rejected')
        return this.correct(event.candidate, event.verdict.findings);
      if (!('activation' in event) || event.activation.outcome.kind === 'blocked') continue;
      const interrupted = await this.applyActivity(event.activation);
      if (interrupted) return interrupted;
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
    propose: () => Promise<unknown>,
    reason?: RevisionFeedback,
  ): Promise<TaskOutcome | undefined> {
    let result = await this.planResponse(propose, reason);
    while (result.kind === 'question') {
      const feedback = await this.answer(result);
      if ('reason' in feedback) return feedback;
      this.session.record({ feedback });
      result = await this.planResponse(
        () =>
          this.services.direction.revise(
            this.session,
            this.plan,
            feedback,
            this.signal,
            this.assessmentInput(),
          ),
        reason,
        feedback,
      );
    }
    if (result.kind === 'satisfied') {
      const assessment = { ...result, commit: this.standing!.revision };
      this.session.record({ assessment });
      return assessment;
    }
    return this.commitPlan(result.plan, reason);
  }

  /** Give an invalid Director response one repair in the same task and planning context. */
  private async planResponse(
    propose: () => Promise<unknown>,
    reason?: RevisionFeedback,
    context = reason,
  ): Promise<DirectionResult> {
    try {
      return this.validateProposal(await propose(), reason);
    } catch (error) {
      if (!(error instanceof DirectorResponseError)) throw error;
      const feedback: Feedback = {
        kind: 'plan-repair',
        diagnostic: error.message,
        ...(context ? { original: context } : {}),
      };
      this.session.record({ feedback });
      this.report({
        phase: 'planning',
        message: `Director proposal requires repair: ${error.message}`,
      });
      const repaired = await this.services.direction.revise(
        this.session,
        this.plan,
        feedback,
        this.signal,
        this.assessmentInput(),
      );
      return this.validateProposal(repaired, reason);
    }
  }

  /** Check proposal shape, plan rules and preservation of any already accepted work. */
  private validateProposal(response: unknown, reason?: RevisionFeedback): DirectionResult {
    this.signal.throwIfAborted();
    const result = decodeDirectorResponse(response, this.assessmentInput());
    if (result.kind !== 'plan') return result;
    try {
      validatePlan(this.session.capture, result.plan);
      if (this.plan)
        validateRevision(this.plan, result.plan, this.completed, this.activityPositions);
      if (reason?.kind === 'rejection')
        validateCorrection(result.plan, this.completed, reason.findings);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      throw new DirectorResponseError(error.message, { cause: error });
    }
    return result;
  }

  /** Limit the no-work outcome to the initial standing-goal assessment. */
  private assessmentInput() {
    return this.plan ? undefined : this.standing;
  }

  /** Admit a validated plan only when its supplier sequence can advance. */
  private commitPlan(plan: Plan, reason?: RevisionFeedback): Interrupted | undefined {
    let supplier;
    if (this.plan && reason?.kind === 'supplier') {
      const milestone = scheduledSupplier(
        this.plan,
        plan,
        reason,
        this.completed,
        this.activityPositions,
      );
      if (!milestone)
        return stopped(
          'blocked',
          `The Director must schedule runnable supplier work for ${reason.owner} before ${reason.requester}`,
          reason.evidence,
        );
      supplier = { milestone, request: reason };
    }
    this.plan = plan;
    this.session.record(supplier ? { plan, supplier } : { plan });
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
  private async executeMilestone(milestone: Milestone): Promise<TaskOutcome | undefined> {
    const start = this.activityPositions.get(milestone.id) ?? 0;
    for (const [index, step] of milestone.steps.entries()) {
      if (index < start || step.inapplicable || step.activity === 'release') continue;
      this.signal.throwIfAborted();
      const outcome = await this.activate(milestone, step.activity);
      const record = {
        milestone: milestone.id,
        owner: milestone.owner,
        index,
        step: step.activity,
        outcome,
      };
      await this.services.execution.checkpoint?.(this.session, record, this.signal);
      this.signal.throwIfAborted();
      const interrupted = await this.applyActivity(record);
      if (interrupted || outcome.kind !== 'completed') return interrupted;
    }
    this.completed++;
    this.recordPosition();
  }

  /** Advance a durable completion or route a retained non-terminal outcome through Direction. */
  private async applyActivity({ milestone, index, step, outcome }: ActivityCheckpoint) {
    if (outcome.kind === 'blocked') return stopped('blocked', outcome.reason, outcome.evidence);
    if (outcome.kind === 'question') {
      const feedback = await this.answer(outcome);
      return 'reason' in feedback ? feedback : this.revise(feedback);
    }
    if (outcome.kind === 'supplier') return this.revise({ ...outcome, requester: milestone });
    this.report({ phase: 'activity', message: `Completed ${step}`, evidence: outcome.evidence });
    this.activityPositions.set(milestone, index + 1);
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
  private async revise(feedback: RevisionFeedback) {
    this.session.record({ feedback });
    this.report({
      phase: 'planning',
      message: `Director is considering ${feedback.kind} feedback`,
    });
    return this.acceptPlan(
      () =>
        this.services.direction.revise(
          this.session,
          this.plan,
          feedback,
          this.signal,
          this.assessmentInput(),
        ),
      feedback,
    );
  }

  /** Evaluate one assembled candidate and keep a rejected candidate out of delivery. */
  private async review(plan: Plan): Promise<TaskOutcome | undefined> {
    this.report({
      phase: 'verification',
      message: 'Assembling the candidate for independent review',
    });
    const candidate = await this.services.execution.assemble(this.session, this.signal);
    this.signal.throwIfAborted();
    if (this.rejectedReviews.has(reviewKey(candidate)))
      throw new Error('Correction repeated a rejected candidate and its review evidence');
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
    if (verdict.kind === 'rejected') return this.correct(candidate, verdict.findings);
    this.report({
      phase: 'delivery',
      message: 'Reviewer accepted the candidate',
      evidence: verdict.evidence,
    });
    return this.services.delivery.integrate(this.session, candidate, verdict, this.signal);
  }

  /** Hold delivery and route criterion-linked rejection evidence to Direction. */
  private async correct(
    candidate: Candidate,
    findings: Extract<Feedback, { kind: 'rejection' }>['findings'],
  ) {
    this.rejectedReviews.add(reviewKey(candidate));
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

/** Keep rejections scoped to the exact tree and material evidence reviewed. */
function reviewKey(candidate: Candidate) {
  return `${candidate.digest}:${candidate.ownerEvidenceDigest ?? ''}`;
}

/** Mount the same Workflow service for the CLI and other adapters. */
export function workflowPlugin(services?: WorkflowServices) {
  return (context: Context) => {
    context.provide('workflow', new Workflow(services));
  };
}
