import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCheckpoint } from '../assignment/steward.js';
import { candidateDigest } from '../change-inspection/changes.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { git } from '../operations/process.js';
import { CandidateSnapshots } from '../workspace/candidates.js';
import { save, type RecordData } from '../workspace/state.js';
import { assertIdentity } from '../workspace/workspace.js';

type PendingReconciliation = {
  recordId: string;
  workspace: string;
  current: string;
  revision: string;
};

/** Finishes observed workspace reconciliation without moving retained branches or replaying setup. */
export class ReconciledContinuation {
  /** Shares the assignment journal and filesystem evidence with normal dispatch and recovery. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Accepts only a fully prepared, unchanged successor of the original validated checkpoint. */
  recover(assignment: ExecutionAssignment, record: RecordData): void {
    const pending = assignment.data.reconciliation as PendingReconciliation | undefined;
    if (!pending) return;
    validateCheckpoint(this.root, record);
    if (pending.recordId === record.reconciliationId) {
      this.store.updateAssignment(assignment.id, this.store.assignment(assignment.id).status, {
        reconciliation: null,
      });
      return;
    }
    const path = join(this.root, 'runs', pending.recordId, 'report.json');
    if (!existsSync(path)) throw new Error('Continuation has uncertain workspace preparation');
    const next = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    this.validate(assignment, record, next, pending);
    assertIdentity(next);
    const snapshots = new CandidateSnapshots(next.source, join(this.root, 'snapshots'));
    const observed = snapshots.capture(next.workspace, next.base);
    if (
      git(next.source, 'rev-parse', observed + '^{tree}').trim() !==
      git(next.source, 'rev-parse', pending.revision + '^{tree}').trim()
    )
      throw new Error('Reconciled workspace differs from its retained transition');
    this.complete(assignment, record, next);
  }

  /** Checks preparation identity before trusting a retained successor as this assignment's work. */
  private validate(
    assignment: ExecutionAssignment,
    record: RecordData,
    next: RecordData,
    pending: PendingReconciliation,
  ): void {
    if (
      next.id !== pending.recordId ||
      next.workspace !== pending.workspace ||
      next.base !== pending.current ||
      next.status !== 'prepared' ||
      next.assignmentId !== assignment.id ||
      next.executionRunId !== assignment.runId ||
      next.commonDir !== record.commonDir ||
      next.source !== record.source
    )
      throw new Error('Continuation has uncertain workspace preparation');
  }

  /** Publishes the successor checkpoint first; the store transition can then be recovered idempotently. */
  complete(assignment: ExecutionAssignment, record: RecordData, next: RecordData): void {
    record.previousWorkspaces = [
      ...((record.previousWorkspaces ?? []) as string[]),
      record.workspace,
    ];
    Object.assign(record, {
      workspace: next.workspace,
      branch: next.branch,
      branchBase: next.branchBase,
      members: next.members,
      materializationBinding: next.materializationBinding,
      base: next.base,
      reconciliationConflict: next.reconciliationConflict,
    });
    delete record.developmentHead;
    if (record.nextStage === 'finished') record.nextStage = 'implementation';
    record.reconciledCandidateDigest = candidateDigest(record);
    record.reconciliationId = next.id;
    save(this.root, record);
    this.store.updateAssignment(assignment.id, this.store.assignment(assignment.id).status, {
      reconciliation: null,
    });
  }
}
