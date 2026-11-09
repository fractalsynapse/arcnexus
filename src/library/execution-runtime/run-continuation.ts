import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCheckpoint } from '../assignment/steward.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { RecordData } from '../workspace/state.js';
import type { RunAuthority } from './run-authority.js';

/** Validates retained checkpoints before restoring dispatch against the latest verified candidate. */
export class RunContinuation {
  /** Retains captured authority and evidence paths without recapturing mutable source configuration. */
  constructor(
    private readonly root: string,
    private readonly base: string,
    private readonly store: ExecutionStore,
    private readonly authority: RunAuthority,
  ) {}

  /** Resumes only retained safe work; uncertain running activations require explicit reconciliation. */
  resume(run: ExecutionRun, delivery?: ExecutionRun): void {
    this.validate(run, delivery);
    try {
      if ((run.data.uncertainPolicyRecords as string[] | undefined)?.length)
        throw new Error(
          'Policy checkpoint or operation completion is uncertain; inspect retained evidence',
        );
      this.restoreCheckpoints(run);
    } catch (error) {
      this.store.updateRun(run.id, 'needs_attention', { error: String(error) });
      throw error;
    }
    this.store.updateRun(run.id, 'running', {
      seen: {},
      pauseReason: null,
      candidateRevision: String(
        run.data.promotionSource
          ? run.data.candidateRevision
          : (delivery?.data.candidateRevision ?? this.base),
      ),
      candidateRecord: run.data.promotionSource
        ? run.data.candidateRecord
        : (delivery?.data.candidateRecord ?? run.data.candidateRecord),
    });
  }

  /** Checks lifecycle and candidate authority before restoring any assignment checkpoints. */
  private validate(run: ExecutionRun, delivery?: ExecutionRun): void {
    if (['stopped', 'stopping'].includes(run.status))
      throw new Error('Stopped run cannot resume; start a new run');
    this.authority.assert(run);
    if (
      delivery &&
      (delivery.environment?.id !== run.environment?.id ||
        delivery.environment?.mode !== run.environment?.mode)
    )
      throw new Error('Cannot resume against a different execution environment');
    if (run.data.integrityError)
      throw new Error(
        'Candidate integrity requires attention; stop before starting validated work',
      );
  }

  /** Restores validated assignment boundaries and leaves uncertain operation evidence untouched. */
  private restoreCheckpoints(run: ExecutionRun): void {
    for (const assignment of this.store.assignments(run.id)) {
      if (assignment.status !== 'interrupted') continue;
      const record = JSON.parse(
        readFileSync(
          join(this.root, 'runs', String(assignment.data.recordId), 'report.json'),
          'utf8',
        ),
      ) as RecordData;
      const pending = assignment.data.reconciliation as { recordId: string } | null;
      if (pending && pending.recordId !== record.reconciliationId)
        throw new Error(
          `Assignment ${assignment.id} has uncertain workspace preparation: ${pending.recordId}`,
        );
      validateCheckpoint(this.root, record);
      this.store.updateAssignment(assignment.id, 'ready', { reconciliation: null });
    }
  }
}
