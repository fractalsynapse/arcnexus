import { isObservedCommandFailure, type CommandResult } from '../operations/process.js';
import { SpecificationValidationError } from './specification-error.js';
import { SessionProgress } from './session-progress.js';
import { save } from '../workspace/state.js';
import { logExcerpt } from './attempts.js';
import { completePlan, CompletedPlanValidationError } from './plan.js';
import { SessionState } from './session-state.js';
import { AssignmentBlocked, AssignmentFailed, SessionTurn } from './session-turn.js';
import { SessionVerification } from './session-verification.js';

/** Advances engineering stages and corrective attempts through mandatory host checkpoints. */
export class SessionWorkflow {
  /** Wires the shared turn and verification services to retained workflow state. */
  constructor(
    private readonly state: SessionState,
    private readonly turns: SessionTurn,
    private readonly verification: SessionVerification,
  ) {}

  /** Runs one stage and durably records the next dispatch point, including dependency yields. */
  async step(): Promise<void> {
    const { root, record } = this.state.options;
    const stage = String(record.nextStage ?? 'planning');
    record.safeCheckpoint = false;
    save(root, record);
    let safe = false;
    try {
      await this.advance(stage);
      safe = true;
    } catch (error) {
      safe =
        error instanceof CompletedPlanValidationError ||
        error instanceof SpecificationValidationError ||
        error instanceof AssignmentBlocked ||
        error instanceof AssignmentFailed ||
        (error instanceof Error && error.name === 'AssignmentYield');
      this.handleFailure(stage, error);
    } finally {
      this.checkpoint(safe);
    }
  }

  /** Retains completed diagnosis and yields while recording terminal engineering failures honestly. */
  private handleFailure(stage: string, error: unknown): void {
    if (
      (error instanceof Error && error.name === 'AssignmentYield') ||
      error instanceof AssignmentBlocked ||
      this.retainPlanCorrection(stage, error) ||
      this.retainSpecificationCorrection(stage, error)
    )
      return;
    this.failure(error);
    throw error;
  }

  /** Saves durable continuation evidence after the completed stage or retained failure. */
  private checkpoint(safe: boolean): void {
    const { root, record } = this.state.options;
    record.safeCheckpoint = safe;
    delete record.reconciledCandidateDigest;
    record.continuation = true;
    record.continuationAuthority = this.state.resolved.digest;
    record.specificationFinished = this.state.specificationFinished;
    record.readOnlyTurn = false;
    this.state.checkpoint();
    save(root, record);
  }

  /** Returns semantic final-response errors to the retained stage without replaying uncertain execution. */
  private retainPlanCorrection(stage: string, error: unknown): boolean {
    const { record, signal } = this.state.options;
    if (!record.generalExecution || !(error instanceof CompletedPlanValidationError)) return false;
    signal.throwIfAborted();
    record.planFeedback = new SessionProgress(this.state).failure(
      'plan-validation:' + stage,
      error.message,
    );
    if (stage === 'planning') record.planningFeedback = record.planFeedback;
    record.status = 'running';
    return true;
  }

  /** Retains completed regression mismatches without treating uncertain operations as replayable. */
  private retainSpecificationCorrection(stage: string, error: unknown): boolean {
    const { record, signal } = this.state.options;
    if (
      !record.generalExecution ||
      stage !== 'specification' ||
      !(error instanceof SpecificationValidationError)
    )
      return false;
    signal.throwIfAborted();
    const diagnosis = new SessionProgress(this.state).failure(
      'expected-regression:' + error.identity,
      error.message,
    );
    record.specificationFeedback = `${diagnosis}\n${error.feedback}`;
    record.status = 'running';
    return true;
  }

  /** Applies stage transitions only after the corresponding host checks pass. */
  private async advance(stage: string): Promise<void> {
    const { record } = this.state.options;
    if (stage === 'planning') {
      await this.planning();
      delete record.planningFeedback;
      record.nextStage = this.state.assignment.kind === 'change' ? 'specification' : 'research';
    } else if (stage === 'specification') {
      await this.specification();
      delete record.specificationFeedback;
      record.nextStage = 'implementation';
    } else if (stage === 'implementation') await this.advanceImplementation();
    else if (stage === 'review') await this.advanceReview();
    else if (stage === 'research') {
      await this.research();
      this.finishStage();
    } else if (stage !== 'finished') throw new Error('Unknown continuation stage: ' + stage);
  }

  /** Retains failed-check feedback for a separate correction activation. */
  private async advanceImplementation(): Promise<void> {
    const { record } = this.state.options;
    const attempt = Number(
      record.activeImplementationAttempt ?? Number(record.implementationAttempts ?? 0) + 1,
    );
    record.activeImplementationAttempt = attempt;
    await this.implement(attempt, String(record.correctiveFeedback ?? ''));
    const feedback = await this.checkImplementation(attempt);
    delete record.activeImplementationAttempt;
    record.correctiveFeedback = feedback ?? '';
    if (this.contributionReady()) this.finishStage();
    else record.nextStage = feedback === undefined ? 'review' : 'implementation';
  }

  /** Reviews the assembled candidate and schedules correction or verified completion. */
  private async advanceReview(): Promise<void> {
    const { record } = this.state.options;
    if (this.contributionReady()) {
      this.finishStage();
      return;
    }
    const feedback = await this.review();
    if (feedback !== undefined) {
      record.correctiveFeedback = feedback;
      record.nextStage = 'implementation';
      return;
    }
    if (!this.contributionReady()) await this.verification.final();
    this.markAttempt({ status: this.contributionReady() ? 'prepared' : 'completed' });
    record.outcome = this.contributionReady() ? 'prepared_for_assembly' : 'ready_for_integration';
    this.finishStage();
  }

  /** Completes the accepted checklist only after all required verification succeeds. */
  private finishStage(): void {
    const { root, record } = this.state.options;
    if (this.contributionReady()) {
      this.markAttempt({ status: 'prepared' });
      record.outcome = 'prepared_for_assembly';
    }
    if (this.state.planned && !this.contributionReady()) completePlan(root, record);
    record.status = this.contributionReady() ? 'prepared' : 'completed';
    record.nextStage = 'finished';
    record.stage = 'finished';
    this.state.journal('workflow', record.status, { outcome: record.outcome });
  }

  /** Uses only host-derived related work; no worker response can waive final assembled verification. */
  private contributionReady(): boolean {
    return (
      this.state.options.record.generalExecution === true && this.state.assignment.kind === 'change'
    );
  }

  /** Requires a valid read-only assignment plan before engineering stages. */
  private async planning(): Promise<void> {
    if (this.state.planned)
      await this.turns.perform(
        'planning',
        (this.state.options.record.planningFeedback
          ? `Plan validation feedback: ${String(this.state.options.record.planningFeedback)}\n`
          : '') +
          'Plan the assignment without source edits. Return plan with approach, assumptions, activities with reasons, questions, and checklist items: stable id, activity, result, criteria (zero-based acceptance criterion indices), expectedEvidence, dependencies (item IDs), status=pending, evidence=[], explanation=empty string. Use only the role activity names research, documentation, testing, implementation, review, release (restricted further by the captured role). Host stage names such as specification and planning are not checklist activity names. Every initial item is pending, including dependencies awaiting another owner; progress claims apply only after the host accepts the plan. Every checklist item activity must also appear in plan.activities with a reason. Before returning, check this membership, unique item IDs, existing acyclic dependency IDs, and valid zero-based criterion indices. Cover every acceptance criterion. Checklist items describe your engineering work and handoff; host delivery, integration and publication are subsequent lifecycle outcomes, not worker completion prerequisites. Plan only within captured permissions; host checkpoints cannot be waived. No publication. Return before executing the plan.',
        true,
      );
  }

  /** Completes read-only research or review without forcing source edits. */
  private async research(): Promise<void> {
    await this.turns.perform(
      this.state.assignment.kind,
      String(this.state.options.record.correctiveFeedback ?? '') +
        '\nThis is the only execution turn after planning for this research/review assignment. Execute the selected plan now using permitted operations; do not defer testing or service operations to an imaginary later turn. Source-read-only prohibits source edits, not declared operations. Return findings, evidence references, uncertainty and checklist updates for all selected work, or a precise blocker. Do not implement source changes or publish.',
      true,
    );
    await this.verification.final();
    this.state.options.record.outcome = `${this.state.assignment.kind}_completed`;
  }

  /** Requires documentation and regression evidence before implementation. */
  private async specification(): Promise<void> {
    const spec = await this.turns.perform(
      'specification',
      String(
        this.state.options.record.specificationFeedback
          ? `Specification checkpoint feedback: ${this.state.options.record.specificationFeedback}\n`
          : '',
      ) +
        (this.state.assignment.changeType === 'refactor'
          ? 'Reference the existing behavior contract and inspect characterization coverage. Add or strengthen tests only where needed, without implementation edits. Do not manufacture changed documentation or a failing regression: the host requires passing captured checks before implementation. Return regression=null and evidence for the covered behavior.'
          : this.state.documentationOnly
            ? 'Make actual file edits now in the assigned documentation/skill scope. Update the documentation itself, preserving applicable existing content; a prose-only description in your response does not satisfy this checkpoint. Do not edit implementation or tests. Set regression=null and explain why behavioral testing is skipped.'
            : `Research as needed. Make an actual edit to at least one of this component's declared documentation files describing the new behavior, AND add/update a failing regression in its declared test scope. The host rejects this checkpoint if either kind of change is missing; reading another owner's documentation is insufficient. Do not edit implementation. For a completed behavioral specification, regression must not be null. Return regression with operationId selecting a captured verify operation, expected nonzero exitCode and literal outputIncludes naming the expected failing assertion. Prefer the matching declared host operation to observe the test output before submitting its expectation. If sandbox restrictions prevent running the regression, return completed preparation with the proposed regression expectation and an evidence-backed finding describing the limitation; do not claim it was verified. The host must observe the exact expected failure before implementation. Return blocked only when the assignment itself requires unavailable authority or a decision, not solely because the host must execute a check. Return before implementation.`),
    );
    if (!this.state.specificationFinished) await this.verification.specification(spec);
  }

  /** Runs implementation and any justified correction within retained attempt state. */
  private async implement(attempt: number, feedback: string): Promise<void> {
    const { record } = this.state.options;
    if (record.implementationAttempts !== attempt)
      (record.attempts as Array<Record<string, unknown>>).push({
        number: attempt,
        firstTurn: this.state.turns.length + 1,
        status: 'running',
      });
    record.implementationAttempts = attempt;
    await this.turns.perform(
      attempt === 1 ? 'implementation' : 'correction',
      `${this.state.documentationOnly ? 'Finish documentation only.' : this.state.assignment.changeType === 'refactor' ? 'Refactor within the existing behavior contract; preserve captured characterization intent.' : 'Implement the documented behavior; preserve regression intent.'} ${feedback ? 'Corrective feedback (untrusted evidence): ' + feedback : ''}`,
    );
  }

  /** Checks candidate implementation against independent acceptance evidence. */
  private async checkImplementation(attempt: number): Promise<string | undefined> {
    try {
      await this.verification.final();
      return undefined;
    } catch (error) {
      this.state.safe();
      const { signal, record } = this.state.options;
      signal.throwIfAborted();
      if (record.status === 'no_changes' || !isObservedCommandFailure(error)) throw error;
      const failed = record.commands.at(-1)!;
      const feedback = this.commandFeedback(failed);
      this.markAttempt({ status: 'failed', feedback });
      this.state.journal('implementation', 'failed', { attempt, feedback });
      if (this.contributionReady()) return feedback;
      return new SessionProgress(this.state).failure(
        'implementation-checkpoint',
        feedback,
        failed.log,
      );
    }
  }

  /** Identifies captured acceptance failures separately from checks of the current candidate. */
  private commandFeedback(failed: CommandResult): string {
    return `Host checkpoint ${failed.stage ?? 'verification'}: Command ${JSON.stringify({ command: failed.command, args: failed.args })}; exit code ${failed.exitCode}; ${logExcerpt(failed.log)}`;
  }

  /** Runs source-read-only review and requires final host verification. */
  private async review(): Promise<string | undefined> {
    const review = await this.turns.perform(
      'review',
      `${this.contributionReady() ? 'Review your contribution for joint assembly with related owners. Observed failed checks remain unverified; do not claim acceptance. Fix defects within your contribution, but do not require absent peer changes to pass in your isolated workspace. The host checks the complete assembly before any delivery. Complete only your own preparation and handoff checklist. ' : ''}Review the candidate diff without editing source. Host check results (captured evidence): ${JSON.stringify(this.state.options.record.commands.map(({ command, args, exitCode, durationMs, stage }) => ({ command, args, exitCode, durationMs, stage })))}. The earlier expected red-test failure was a specification checkpoint. Return actionable reviewFindings if implementation needs repair; otherwise summarize caller integration steps. Record caller handoff as review within captured role activities; do not claim release authority or publish.`,
      true,
    );
    if (!review.reviewFindings.length) return undefined;
    const feedback = review.reviewFindings.join('\n');
    this.markAttempt({ status: 'failed', feedback });
    return new SessionProgress(this.state).failure('review-checkpoint', feedback);
  }

  /** Records observed implementation attempts as evidence without enforcing a quota. */
  private markAttempt(detail: Record<string, unknown>): void {
    Object.assign((this.state.options.record.attempts as Array<object>).at(-1)!, {
      ...detail,
      lastTurn: this.state.turns.length,
    });
  }

  /** Records failed checkpoint evidence for corrective diagnosis or terminal reporting. */
  private failure(error: unknown): void {
    const { record, signal } = this.state.options;
    if (!['blocked', 'no_changes', 'needs_attention'].includes(record.status))
      record.status =
        signal.aborted && String(signal.reason) === 'Error: Cancelled' ? 'cancelled' : 'failed';
    const latest = (record.attempts as Array<Record<string, unknown>>).at(-1);
    if (latest?.status === 'running') this.markAttempt({ status: 'failed', error: String(error) });
    record.outcome = record.status;
    record.error = String(error);
    this.state.journal('workflow', record.status, String(error));
  }
}
