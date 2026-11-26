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
import type { Candidate, Verdict } from '../../verification/src/index.js';
import { PublicationCheckFailure } from '../../delivery/src/index.js';
import { activityRepair, replayableActivity, supplierRequestRepair } from './activity-repair.js';
import {
  assessCandidate,
  deliverAcceptedCandidate,
  plannerCorrection,
  requestPlan,
  reviewKey,
} from './assembly.js';
import { stopped, type Interrupted } from './services.js';
import { reviewedHold, supersededReviewedHold } from './reviewed-hold.js';
import type {
  ActivityCheckpoint,
  ActivityRepair,
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
  private publicationFailure?: PublicationCheckFailure;
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
    const resumed = this.session.documentationOnly ? undefined : await this.resumeDelivery();
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

  /** Observe retained publication first and return failed checks to normal preparation. */
  private async resumeDelivery() {
    try {
      return await this.services.delivery.resume?.(
        this.session,
        this.signal,
        this.report.bind(this),
      );
    } catch (error) {
      this.signal.throwIfAborted();
      if (!(error instanceof PublicationCheckFailure)) throw error;
      this.publicationFailure = error;
    }
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

  /** Admit exact Planner edits or record its read-only result. */
  private async startPlanner(mode: NonNullable<TaskInput['planning']>) {
    const decision = await requestPlan(this.services.planner, this.session, {
      mode,
      progress: this.report.bind(this),
      signal: this.signal,
      draft: this.input.guideDraft,
    });
    return 'kind' in decision ? decision : this.commitPlan(decision);
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
    for (const event of events) {
      if ('verdict' in event && event.verdict.kind === 'rejected')
        return this.correct(event.candidate, event.verdict.findings);
      if (!('activation' in event)) continue;
      if (
        !replayableActivity(
          this.session.capture,
          this.plan!.milestones[this.completed],
          event.activation,
        )
      )
        continue;
      if (await supersededReviewedHold(this.session, event.activation, this.signal)) continue;
      const interrupted = await this.applyActivity(event.activation);
      if (interrupted) return interrupted;
    }
  }

  /** Persist a checkpoint before exposing it to the observer. */
  private report(observation: Observation) {
    if (observation.evidence) this.evidence.push(...observation.evidence);
    this.session.record(observation);
    if (!this.session.listen || !this.observer.event) this.observer.progress(observation);
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
    if ('reason' in result) return result;
    if (result.kind === 'satisfied') {
      const assessment = { ...result, commit: this.standing!.revision };
      this.session.record({ assessment });
      return assessment;
    }
    return this.commitPlan(result.plan, reason);
  }

  /** Repair distinct validation findings with Direction and hold an unchanged repeated finding. */
  private async planResponse(
    propose: () => Promise<unknown>,
    reason?: RevisionFeedback,
    context = reason,
  ): Promise<DirectionResult | Interrupted> {
    const seen = new Set<string>();
    let request = propose;
    while (true) {
      try {
        return this.validateProposal(await request(), reason);
      } catch (error) {
        this.signal.throwIfAborted();
        if (!(error instanceof DirectorResponseError)) throw error;
        if (seen.has(error.identity))
          return stopped(
            'blocked',
            `Director repeated an unchanged validation finding: ${error.message}`,
            this.evidence,
          );
        seen.add(error.identity);
        request = () => this.repairPlan(error.message, context);
      }
    }
  }

  /** Retain the exact diagnostic and original sequencing finding before returning to its caller. */
  private repairPlan(diagnostic: string, context?: RevisionFeedback) {
    const feedback: Feedback = {
      kind: 'plan-repair',
      diagnostic,
      ...(context ? { original: context } : {}),
    };
    this.session.record({ feedback });
    this.report({ phase: 'planning', message: `Director proposal requires repair: ${diagnostic}` });
    return this.services.direction.revise(
      this.session,
      this.plan,
      feedback,
      this.signal,
      this.assessmentInput(),
    );
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

  /** Advance completion, persist local repair, or sequence an explicit escalation. */
  private async applyActivity(activation: ActivityCheckpoint) {
    const { milestone, index, step, outcome } = activation;
    const rejected = supplierRequestRepair(this.plan!, activation);
    if (rejected) {
      this.report(rejected);
      return;
    }
    if (outcome.kind === 'repair') return this.repair(activation);
    if (outcome.kind === 'blocked') {
      return reviewedHold(this.session, activation, (feedback) => this.revise(feedback));
    }
    if (outcome.kind === 'question') {
      const feedback = await this.answer(outcome);
      if ('reason' in feedback) return feedback;
      this.session.record({ feedback });
      return;
    }
    if (outcome.kind === 'supplier') return this.revise({ ...outcome, requester: milestone });
    this.report({ phase: 'activity', message: `Completed ${step}`, evidence: outcome.evidence });
    this.activityPositions.set(milestone, index + 1);
    this.recordPosition();
  }

  /** Commit the rewind and its diagnostic together so interruption cannot replay a repair. */
  private repair(activation: ActivityCheckpoint) {
    const milestone = this.plan!.milestones[this.completed]!;
    const result = activityRepair(
      this.session.capture,
      milestone,
      activation,
      this.session.history?.() ?? [],
    );
    if ('kind' in result) return result;
    this.activityPositions.set(milestone.id, result.index);
    this.recordPosition(result.repair);
    this.report({
      phase: 'activity',
      message: `Repair ${milestone.owner}/${result.repair.activity}: ${result.repair.reason}`,
      evidence: result.repair.evidence,
    });
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
    const { candidate, verdict } = await assessCandidate(
      this.services,
      this.session,
      this.input,
      plan,
      this.signal,
      this.rejectedReviews,
    );
    if (verdict.kind === 'blocked') return stopped('blocked', verdict.reason, verdict.evidence);
    if (verdict.kind === 'rejected') return this.correct(candidate, verdict.findings);
    return this.publish(candidate, verdict);
  }

  /** Reconcile provider facts before holding an unchanged publication finding. */
  private async publish(candidate: Candidate, verdict: Extract<Verdict, { kind: 'accepted' }>) {
    try {
      return await deliverAcceptedCandidate(
        this.services,
        this.session,
        candidate,
        verdict,
        this.signal,
        this.report.bind(this),
      );
    } catch (error) {
      this.signal.throwIfAborted();
      if (!(error instanceof PublicationCheckFailure)) throw error;
      if (this.publicationFailure?.identity === error.identity)
        return stopped('blocked', error.message, error.evidence);
      this.publicationFailure = error;
    }
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
    const decision = await plannerCorrection(
      this.input.guideDraft
        ? undefined
        : this.services.planner!.propose(
            this.session,
            this.input.planning!,
            this.report.bind(this),
            this.signal,
            findings,
          ),
      this.plan!,
      this.session.capture,
      this.evidence,
    );
    return 'kind' in decision ? decision : this.commitPlan(decision);
  }

  /** Preserve the plan and live cursor for later observations. */
  private recordPosition(repair?: ActivityRepair) {
    this.session.record({
      position: {
        completed: this.completed,
        activities: Object.fromEntries(this.activityPositions),
      },
      ...(repair ? { repair } : {}),
    });
  }
}
