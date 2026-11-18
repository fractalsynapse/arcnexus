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
import { validateVerdict, type Candidate, type Verdict } from '../../verification/src/index.js';
import { blockedCorrection } from './blocked-correction.js';
import { stopped, type Interrupted } from './services.js';
import type {
  ActivityCheckpoint,
  Observation,
  TaskEvent,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

/** Keep only the live cursor for one task. The supplied session persists accepted decisions. */
export class TaskRun {
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
    private readonly input: TaskInput,
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
    const recorded = saved.findLast((event) => 'assessment' in event)?.assessment;
    if (recorded && this.input.planning !== 'exploration') return recorded;
    this.plan = saved.findLast((event) => 'plan' in event)?.plan;
    if (!this.plan) {
      const planning = await this.startPlanning();
      if (planning) return planning;
    }
    if (this.services.direction.track && this.services.execution.prepare) {
      const issue = await this.services.direction.track(this.session, this.signal);
      await this.services.execution.prepare(this.session, issue, this.signal);
    }
    return this.restore();
  }

  /** Give Direction the authored standing goal and measured staging context before admitting work. */
  private async startPlanning() {
    if (this.input.planning) return this.startPlanner(this.input.planning);
    if (this.input.standing) {
      if (!this.services.execution.observeGoal)
        throw new Error('Standing goal assessment is unavailable in this build');
      this.standing = this.services.execution.observeGoal(this.session, this.signal);
    }
    this.report({
      phase: 'planning',
      message: this.standing
        ? 'Director is assessing the standing goal'
        : 'Director is planning the goal',
      evidence: this.standing ? [this.standing.revision] : undefined,
    });
    return this.acceptPlan(() =>
      this.services.direction.plan(this.session, this.signal, this.standing),
    );
  }

  /** Admit the exact approved Planner edit set or record its read-only result. */
  private async startPlanner(mode: NonNullable<TaskInput['planning']>) {
    const planner = this.services.planner;
    if (!planner) return stopped('invalid', 'Planner is unavailable in this build');
    const decision = await planner.propose(
      this.session,
      mode,
      (event) => this.report(event),
      this.signal,
    );
    if ('kind' in decision) {
      this.session.record({ assessment: decision });
      return decision;
    }
    validatePlan(this.session.capture, decision);
    return this.commitPlan(decision);
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
    return this.replayOutcomes(last);
  }

  /** Recover the latest blocked step once and keep ordinary user retries available. */
  private async replayOutcomes(events: readonly TaskEvent[]) {
    const latest = events.findLast((event) => 'activation' in event);
    for (const event of events) {
      if ('verdict' in event && event.verdict.kind === 'rejected')
        return this.correct(event.candidate, event.verdict.findings);
      if (!('activation' in event)) continue;
      if (event.activation.outcome.kind === 'blocked') {
        const recovery = event === latest && this.blockedRecovery(event.activation);
        if (recovery) return this.revise(recovery);
        continue;
      }
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
  private async applyActivity(activation: ActivityCheckpoint) {
    const { milestone, index, step, outcome } = activation;
    if (outcome.kind === 'blocked') {
      const recovery = this.blockedRecovery(activation);
      return recovery
        ? this.revise(recovery)
        : stopped('blocked', outcome.reason, outcome.evidence);
    }
    if (outcome.kind === 'question') {
      const feedback = await this.answer(outcome);
      return 'reason' in feedback ? feedback : this.revise(feedback);
    }
    if (outcome.kind === 'supplier') return this.revise({ ...outcome, requester: milestone });
    this.report({ phase: 'activity', message: `Completed ${step}`, evidence: outcome.evidence });
    this.activityPositions.set(milestone, index + 1);
    this.recordPosition();
  }

  /** Select the existing correction route only for the currently paused milestone. */
  private blockedRecovery(activation: ActivityCheckpoint) {
    return blockedCorrection(
      this.session.history?.() ?? [],
      this.plan?.milestones[this.completed],
      activation,
    );
  }

  /** Report the selected activity before starting the next scoped Agent activation. */
  private activate(
    milestone: Milestone,
    activity: Exclude<Milestone['steps'][number]['activity'], 'release'>,
  ) {
    this.report({ phase: 'activity', message: `${milestone.owner}/${activity} (${milestone.id})` });
    if (this.input.planning) return this.services.planner!.apply(this.session, this.signal);
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
    const candidate = await this.services.execution.assemble(
      this.session,
      this.signal,
      this.input.standing,
    );
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
    return this.acceptCandidate(candidate, verdict);
  }

  /** Record a verified check-only assessment or deliver a changed candidate. */
  private acceptCandidate(candidate: Candidate, verdict: Extract<Verdict, { kind: 'accepted' }>) {
    if (candidate.unchanged) {
      const assessment = {
        kind: 'satisfied' as const,
        commit: this.session.capture.source.revision,
        summary: 'Independent review accepted the checks on the unchanged staging tree',
        evidence: verdict.evidence,
      };
      this.session.record({ assessment });
      return assessment;
    }
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
    if (this.input.planning) return this.correctPlanner(findings);
    return this.revise({ kind: 'rejection', findings });
  }

  /** Get a corrected proposal and retain earlier checkpoints before reviewing it again. */
  private async correctPlanner(findings: Extract<Feedback, { kind: 'rejection' }>['findings']) {
    const prior = this.plan!;
    const decision = await this.services.planner!.propose(
      this.session,
      this.input.planning!,
      (event) => this.report(event),
      this.signal,
      findings,
    );
    if ('kind' in decision)
      return stopped('blocked', 'Planner correction needs an approved goal change', this.evidence);
    const correction = {
      ...decision.milestones[0]!,
      id: `planner-correction-${prior.milestones.length}`,
      criteria: prior.milestones[0]!.criteria,
    };
    const revised = { ...prior, milestones: [...prior.milestones, correction] };
    validatePlan(this.session.capture, revised);
    return this.commitPlan(revised);
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
