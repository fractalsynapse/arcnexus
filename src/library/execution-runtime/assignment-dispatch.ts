import { ReconciledContinuation } from './reconciled-continuation.js';
import { createHash } from 'node:crypto';
import { assignmentIntent } from './assignment-intent.js';
import type { Assignment } from '../architecture/assignment.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import { validateCheckpoint } from '../assignment/steward.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import {
  canContinueAssignment,
  canReopenAssignment,
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

  /** Captures required assignments and current request identities from one consistent store snapshot. */
  state(runId: string) {
    return this.store.snapshot(() =>
      this.store.requiredAssignments(runId).map((assignment) => ({
        ...assignment,
        inbox: this.store.inbox(assignment.id),
      })),
    );
  }

  /** Validates every scope and checkpoint before any proposal can become runnable. */
  apply(run: ExecutionRun, result: DirectorResult, checkpoint: Record<string, unknown> = {}): void {
    const id = createHash('sha256')
      .update(
        JSON.stringify({
          runId: run.id,
          result,
          checkpoint,
          history: this.store.run(run.id).data.directionHistory ?? [],
        }),
      )
      .digest('hex');
    if (this.store.directionAdmitted(run.id, id)) return;
    const retirements = this.retirements(run, result);
    const continuations = result.continuations.filter((item) =>
      this.eligible(
        run,
        item,
        retirements.some((retired) => retired.assignmentId === item.assignmentId),
      ),
    );
    this.store.admitDirection(run.id, this.proposals(run, result), continuations, checkpoint, {
      id,
      retirements,
    });
  }

  /** Resolves proposed owner authority and captures the director's context before admission. */
  private proposals(run: ExecutionRun, result: DirectorResult) {
    for (const proposal of result.assignments) {
      const { ownerId, ...assignment } = proposal;
      new ExecutionContext().assignment(this.context, ownerId, {
        schemaVersion: 3,
        ...assignment,
        expectedOutcome: proposal.objective,
        hostChecks: [],
      });
    }
    const directionContext = {
      summary: result.summary,
      feedback: this.store.run(run.id).data.redirection,
      prompt: run.data.prompt,
    };
    return result.assignments.map((proposal) => ({
      owner: proposal.ownerId,
      objective: proposal.objective,
      acceptance: proposal.acceptanceCriteria,
      data: { proposal, directionContext },
    }));
  }

  /** Checks the current request and supplier checkpoint before treating retirement as material progress. */
  private retirements(run: ExecutionRun, result: DirectorResult) {
    const proposal = result.dependencyRetirementProposal;
    if (!proposal) return [];
    if (!proposal.rationale.trim()) throw new Error('Request retirement requires a rationale');
    const request = this.store.requestById(proposal.requestId);
    const source = this.store.assignment(request.from);
    const recipient = this.store.assignment(request.assignmentId);
    if (
      source.runId !== run.id ||
      recipient.runId !== run.id ||
      request.retired ||
      !source.dependencies.includes(recipient.id) ||
      !result.continuations.some(
        (item) => item.assignmentId === source.id && !item.replacementChangeType,
      )
    )
      throw new Error('Retirement requires the current requester continuation in this run');
    if (['running', 'interrupted'].includes(recipient.status))
      throw new Error('Cannot retire in-flight supplier work');
    this.retirementCheckpoints(recipient, new Set());
    return [{ assignmentId: source.id, requestId: request.id, rationale: proposal.rationale }];
  }

  /** Refuses uncertain descendants before disconnecting any request-only subtree. */
  private retirementCheckpoints(assignment: ExecutionAssignment, visited: Set<string>): void {
    if (visited.has(assignment.id)) return;
    visited.add(assignment.id);
    if (['running', 'interrupted'].includes(assignment.status) || assignment.data.pendingOutcome)
      throw new Error('Cannot retire in-flight supplier work');
    this.checkpoint(assignment, true, 'retain');
    for (const id of assignment.dependencies)
      this.retirementCheckpoints(this.store.effective(id), visited);
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
    changedObligation = false,
  ): boolean {
    try {
      this.validate(run, continuation, changedObligation);
      return true;
    } catch (error) {
      if (run.mode !== 'workday' || !(error instanceof Error) || error.name !== 'NeedsAttention')
        throw error;
      this.store.fail(continuation.assignmentId, 'failed', error.message);
      return false;
    }
  }

  /** Refuses scope substitution and uncertain operations while preserving accepted engineering evidence. */
  private validate(
    run: ExecutionRun,
    continuation: DirectorResult['continuations'][number],
    changedObligation: boolean,
  ): void {
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
    this.checkpoint(assignment, changedObligation);
  }

  /** Verifies the retained workspace and refuses to replay an operation whose outcome is unknown. */
  private checkpoint(
    assignment: ExecutionAssignment,
    changedObligation = false,
    purpose: 'resume' | 'retain' = 'resume',
  ): void {
    if (!assignment.data.recordId) {
      if (assignment.status === 'prepared') throw new Error('Prepared work requires a checkpoint');
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
    new ReconciledContinuation(this.root, this.store).recover(assignment, record);
    validateCheckpoint(this.root, record, purpose);
    if (canReopenAssignment(assignment.status) && !changedObligation)
      this.diagnose(record, assignment);
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
        acknowledgedReceipt: assignment.data.lastReceipt,
        failedReceipt: (assignment.data.lastFailedOutcome as { receipt?: string } | null)?.receipt,
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
