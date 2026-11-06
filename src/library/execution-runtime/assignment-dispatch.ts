import { assignmentIntent } from './assignment-intent.js';
import type { Assignment } from '../architecture/assignment.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import { validateContinuation } from '../assignment/steward.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import {
  canContinueAssignment,
  type ExecutionRun,
  type ExecutionAssignment,
} from '../coordination-store/execution-types.js';
import { StewardshipRefusal, type DirectorResult } from '../task-intake/direction.js';
import { save, type RecordData } from '../workspace/state.js';
import { ProgressObserver } from '../report/progress.js';
import { materialCandidate } from '../change-inspection/changes.js';

/** Validates proposed work and retained continuations before changing scheduling readiness. */
export class AssignmentDispatch {
  /** Shares captured authority and the sole project store with lifecycle policy. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {}

  /** Validates every scope and checkpoint before any proposal can become runnable. */
  apply(run: ExecutionRun, result: DirectorResult, checkpoint: Record<string, unknown> = {}): void {
    for (const proposal of result.assignments) {
      const { ownerId, ...assignment } = proposal;
      new ExecutionContext().assignment(this.context, ownerId, {
        schemaVersion: 3,
        ...assignment,
        expectedOutcome: proposal.objective,
        hostChecks: [],
      });
    }
    const continuations = result.continuations.filter((item) => this.eligible(run, item));
    const directionContext = {
      summary: result.summary,
      feedback: this.store.run(run.id).data.redirection,
      prompt: run.data.prompt,
    };
    const proposals = result.assignments.map((proposal) => ({
      owner: proposal.ownerId,
      objective: proposal.objective,
      acceptance: proposal.acceptanceCriteria,
      data: { proposal, directionContext },
    }));
    this.store.admitDirection(run.id, proposals, continuations, checkpoint);
  }

  /** Retains each owner's considered inputs and architectural questions independently. */
  stewardshipCheckpoint(
    run: ExecutionRun,
    owner: string,
    fingerprint: string,
    result: import('../architecture/initialization.js').InitializationResult | StewardshipRefusal,
  ) {
    const review =
      result instanceof StewardshipRefusal
        ? { status: result.status, error: result.message, recordId: result.recordId }
        : {
            status: result.status,
            questions: result.questions,
            summary: result.summary,
            architectureProposal: result.architectureProposal,
          };
    return {
      seen: { ...(run.data.seen as Record<string, string>), [owner]: fingerprint },
      lastSteward: owner,
      lastDispatch: 'stewardship',
      stewardshipReviews: {
        ...((run.data.stewardshipReviews ?? {}) as object),
        [owner]: { fingerprint, ...review },
      },
    };
  }

  /** Isolates an exhausted diagnosis loop to its workday assignment while preserving task goal failure. */
  private eligible(
    run: ExecutionRun,
    continuation: DirectorResult['continuations'][number],
  ): boolean {
    try {
      this.validate(run, continuation);
      return true;
    } catch (error) {
      if (run.mode !== 'workday' || !(error instanceof Error) || error.name !== 'NeedsAttention')
        throw error;
      this.store.fail(continuation.assignmentId, 'failed', error.message);
      return false;
    }
  }

  /** Refuses scope substitution and uncertain operations while preserving accepted engineering evidence. */
  private validate(run: ExecutionRun, continuation: DirectorResult['continuations'][number]): void {
    const assignment = this.store.assignment(continuation.assignmentId);
    if (assignment.runId !== run.id || assignment.owner !== continuation.ownerId)
      throw new Error('Continuation must name an existing owner assignment in this run');
    if (!canContinueAssignment(assignment.status))
      throw new Error('Continuation cannot reopen active or completed work');
    if (assignment.data.replacedBy) {
      if (
        continuation.replacementChangeType === assignment.data.replacementWorkflow &&
        continuation.reason === assignment.data.replacementReason
      )
        return;
      throw new Error('Assignment already replaced; inspect its current successor');
    }
    this.replacementAuthority(assignment, continuation);
    this.checkpoint(assignment);
  }

  /** Verifies the retained workspace and refuses to replay an operation whose outcome is unknown. */
  private checkpoint(assignment: ExecutionAssignment): void {
    if (!assignment.data.recordId) {
      if (assignment.data.reconciliation)
        throw new Error('Checkpoint has uncertain workspace preparation');
      return;
    }
    const record = JSON.parse(
      readFileSync(
        join(this.root, 'runs', String(assignment.data.recordId), 'report.json'),
        'utf8',
      ),
    ) as RecordData;
    const pending = assignment.data.reconciliation as { recordId: string } | null;
    if (pending && pending.recordId !== record.reconciliationId)
      throw new Error('Continuation has uncertain workspace preparation');
    validateContinuation(this.root, record);
    if (assignment.status !== 'ready') this.diagnose(record, assignment);
  }

  /** Rechecks a proposed fresh workflow against the original owner and all original criteria. */
  private replacementAuthority(
    assignment: ExecutionAssignment,
    continuation: DirectorResult['continuations'][number],
  ): void {
    if (continuation.replacementChangeType) {
      const intent = assignmentIntent(assignment.objective, assignment.acceptance, {
        ...(assignment.data.proposal as Partial<Assignment>),
        changeType: continuation.replacementChangeType,
      });
      if (intent.kind !== 'change') throw new Error('Only change assignments can be replaced');
      new ExecutionContext().assignment(this.context, assignment.owner, intent);
    }
  }

  /** Counts equivalent observed blockers across continuations without introducing a retry quota. */
  private diagnose(record: RecordData, assignment: ExecutionAssignment): void {
    record.continuationLoopWarning = new ProgressObserver(this.root, record).failed(
      { activity: 'retained-blocker' },
      'Retained assignment remains blocked without material checkpoint progress',
      JSON.stringify({
        candidate: materialCandidate(record),
        stage: record.nextStage ?? record.stage,
        specificationFinished: record.specificationFinished ?? false,
        dependencies: this.store.inbox(assignment.id).map((request) => ({
          ...request,
          replies: request.replies.filter((reply) => reply.actor !== assignment.id),
        })),
        milestones: assignment.data.milestones,
      }),
    );
    save(this.root, record);
  }
}
