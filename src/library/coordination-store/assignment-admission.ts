import { randomUUID } from 'node:crypto';
import type { ExecutionDatabase } from './execution-database.js';
import {
  canContinueAssignment,
  type ExecutionAssignment,
  type ExecutionRun,
} from './execution-types.js';

/** Admits new or continued engineering work inside its caller's durable transition. */
export class AssignmentAdmission {
  /** Writes only to the execution database that owns the surrounding transaction. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Validates authority and constructs an assignment within the caller's transaction. */
  create(
    runId: string,
    owner: string,
    objective: string,
    acceptance: string[],
    data: Record<string, unknown> = {},
  ): ExecutionAssignment {
    if (!this.db.get<ExecutionRun>('run', runId).owners.includes(owner))
      throw new Error('Unknown eligible owner: ' + owner);
    if (!objective.trim()) throw new Error('Assignment objective is empty');
    const assignment: ExecutionAssignment = {
      id: randomUUID(),
      runId,
      owner,
      objective,
      acceptance,
      status: 'ready',
      dependencies: [],
      evidence: [],
      data,
    };
    this.db.put('assignment', assignment);
    return assignment;
  }

  /** Preserves failed outcome evidence while acknowledging its known routing receipt for correction. */
  continueOne(
    runId: string,
    continuation: { assignmentId: string; ownerId: string; reason: string },
  ): void {
    const assignment = this.db.get<ExecutionAssignment>('assignment', continuation.assignmentId);
    if (
      assignment.data.replacedBy ||
      assignment.runId !== runId ||
      assignment.owner !== continuation.ownerId ||
      !continuation.reason.trim() ||
      !canContinueAssignment(assignment.status)
    )
      throw new Error('Invalid retained assignment continuation');
    const failed = assignment.data.lastFailedOutcome as { receipt?: string } | undefined;
    const receipt = assignment.status === 'ready' ? assignment.data.lastReceipt : failed?.receipt;
    this.db.put('assignment', {
      ...assignment,
      status: 'ready',
      data: {
        ...assignment.data,
        blockedBy: null,
        reason: null,
        continuationReason: continuation.reason,
        lastReceipt: receipt ?? assignment.data.lastReceipt,
        continuationFrom: { status: assignment.status, reason: assignment.data.reason },
      },
    });
  }
}
