import { cleanup, EvidenceRetention } from '../workspace/workspace.js';
import { terminalRunStatuses, type ExecutionRun } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { RecordData } from '../workspace/state.js';

/** Settles lifecycle intent and reclaims terminal dependencies through the ordinary workspace cleanup path. */
export class RunFinalization {
  private observed = -1;

  /** Uses the repository host's existing lease; never starts a competing cleanup host. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Reconciles terminal controls and interrupted finalization only after all managed activation has drained. */
  sweep(): void {
    if (this.observed === this.store.eventSequence()) return;
    let finalized: string | undefined;
    for (const run of this.store.runs()) if (this.reclaim(run)) finalized = run.id;
    if (finalized) this.storage(finalized);
    this.observed = this.store.eventSequence();
  }

  /** Preserves explicit control intent before recording terminal cleanup outcomes. */
  settle(id: string): void {
    const run = this.store.run(id);
    if (run.mode === 'task' && run.status !== 'running')
      this.store.updateRun(id, run.status, { executionOwner: false });
    if (run.status === 'pausing') this.store.updateRun(id, 'paused');
    if (run.status === 'stopping') this.store.updateRun(id, 'stopped');
    this.reclaim(this.store.run(id));
    this.storage(id);
  }

  /** Records preservation refusals without changing engineering outcomes or retrying every scheduler tick. */
  private reclaim(run: ExecutionRun): boolean {
    if (!terminalRunStatuses.includes(run.status)) return false;
    if (run.data.pendingPublication || run.data.dependencyCleanup) return false;
    const items = this.records(run).map((id) => {
      try {
        return { id, status: cleanup(this.root, id).cleanupStatus };
      } catch (error) {
        return { id, status: 'preserved', reason: String(error) };
      }
    });
    this.store.updateRun(run.id, run.status, {
      dependencyCleanup: { finishedAt: new Date().toISOString(), items },
    });
    return true;
  }

  /** Records storage pressure without changing engineering outcomes or hiding the refusal to admit more work. */
  private storage(id: string): void {
    const run = this.store.run(id);
    try {
      new EvidenceRetention(this.root).enforce();
      if (run.data.storageError) this.store.updateRun(id, run.status, { storageError: null });
    } catch (error) {
      this.store.updateRun(id, run.status, { storageError: String(error) });
    }
  }

  /** Uses existing durable references rather than scanning every historical report to rediscover ownership. */
  private records(run: ExecutionRun): string[] {
    const workspace = run.data.workspace as RecordData | undefined;
    const candidate = run.data.candidateRecord as RecordData | undefined;
    const values = [
      workspace?.id,
      candidate?.executionRunId === run.id ? candidate.id : undefined,
      ...((run.data.previousPolicyWorkspaces ?? []) as unknown[]),
      ...this.store.assignments(run.id).map((assignment) => assignment.data.recordId),
    ];
    return [...new Set(values.filter((id): id is string => typeof id === 'string'))];
  }
}
