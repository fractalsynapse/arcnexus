import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCheckpoint } from '../assignment/steward.js';
import {
  canContinueAssignment,
  type ExecutionAssignment,
} from '../coordination-store/execution-types.js';
import type { RecordData } from '../workspace/state.js';

/** Projects runtime-owned checkpoint facts into direction without exposing arbitrary host filesystem reads. */
export class DirectionEvidence {
  /** Retains the private evidence root and current run identity used to validate every reference. */
  constructor(
    private readonly root: string,
    private readonly runId: string,
  ) {}

  /** Enriches current-run assignment state with observed evidence while preserving unknown context unchanged. */
  capture(state: unknown): unknown {
    if (!Array.isArray(state)) return state;
    return state.map((assignment: ExecutionAssignment) => ({
      ...assignment,
      checkpointEvidence: this.assignment(assignment),
    }));
  }

  /** Resolves only validated host-owned record identities and reports missing or foreign evidence honestly. */
  private assignment(assignment: ExecutionAssignment): unknown {
    try {
      if (assignment.runId !== this.runId) throw new Error('Assignment belongs to a different run');
      const id = assignment.data.recordId;
      if (!id)
        return {
          recordId: null,
          continuation: this.continuation(undefined, assignment),
        };
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
        throw new Error('Invalid retained record identity');
      const record = JSON.parse(
        readFileSync(join(this.root, 'runs', id, 'report.json'), 'utf8'),
      ) as RecordData;
      if (
        record.id !== id ||
        record.executionRunId !== this.runId ||
        record.assignmentId !== assignment.id
      )
        throw new Error('Retained record does not match the current assignment');
      return this.project(record, assignment);
    } catch (error) {
      return {
        continuation: { eligible: false, reason: String(error) },
        evidenceUnavailable: true,
      };
    }
  }

  /** Adds only validated eligibility; retained checkpoint facts come from the canonical capture. */
  private project(record: RecordData, assignment: ExecutionAssignment) {
    return {
      recordId: record.id,
      continuation: this.continuation(record, assignment),
    };
  }

  /** Distinguishes validated continuation from uncertain filesystem or managed-operation state. */
  private continuation(record: RecordData | undefined, assignment: ExecutionAssignment) {
    if (!canContinueAssignment(assignment.status) || assignment.data.replacedBy)
      return {
        eligible: false,
        reason: 'Assignment cannot reopen from its current lifecycle state',
      };
    if (!record)
      return {
        eligible: assignment.status !== 'prepared',
        reason:
          assignment.status === 'prepared'
            ? 'Prepared work requires a checkpoint'
            : 'No activation has started',
      };
    try {
      const pending = assignment.data.reconciliation as { recordId: string } | null;
      if (pending && pending.recordId !== record.reconciliationId)
        throw new Error('Workspace preparation has uncertain completion');
      validateCheckpoint(this.root, record);
      return {
        eligible: true,
        reason: 'Retained checkpoint validates against captured authority and candidate',
      };
    } catch (error) {
      return { eligible: false, reason: String(error) };
    }
  }
}
