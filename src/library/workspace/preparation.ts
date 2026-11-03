import { join } from 'node:path';
import { mkdirSync, realpathSync } from 'node:fs';
import { ExecutionContext } from '../architecture/execution-context.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { observe } from '../report/timeline.js';
import { saveMarkdown } from '../report/report.js';
import { WorkspaceResources } from './resources.js';
import { save, stateRoot, type RecordData } from './state.js';
import { createWorkspace, prepareWorkspace } from './workspace.js';

export interface WorkspacePreparationTarget {
  source: string;
  base: string;
  packageId: string;
}

/** Prepares captured packages through the existing executor under exclusive repository ownership. */
export class WorkspacePreparation {
  /** Retains an optional application state root without creating files before preflight. */
  constructor(private readonly root?: string) {}

  /** Captures authority and acquires the host's canonical lease before creating a worktree. */
  async prepare(target: WorkspacePreparationTarget, signal: AbortSignal) {
    signal.throwIfAborted();
    const context = new ExecutionContext().resolve(target.source, target.packageId, target.base);
    const lease = new ExecutionLease(join(context.commonDir, 'arcnexus', 'host.lease.sqlite'));
    try {
      const location = this.root ?? stateRoot();
      for (const name of ['runs', 'workspaces'])
        mkdirSync(join(location, name), { recursive: true, mode: 0o700 });
      const root = realpathSync(location);
      const record = createWorkspace(root, {
        project: context.source,
        base: context.base,
        packageId: context.packageId,
        bindings: context.bindings,
      });
      record.packageId = context.packageId;
      save(root, record);
      await this.execute(root, record, signal);
      return new WorkspaceResources(root).get(record.id);
    } finally {
      lease.close();
    }
  }

  /** Preserves terminal failure/cancellation evidence without removing or replaying partial preparation. */
  private async execute(root: string, record: RecordData, signal: AbortSignal): Promise<void> {
    try {
      await prepareWorkspace(root, record, signal);
    } catch (error) {
      record.status = signal.aborted ? 'cancelled' : 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
    record.outcome = record.status;
    record.finishedAt = new Date().toISOString();
    record.elapsedMs = Date.now() - Date.parse(record.startedAt);
    observe(root, record, 'run.finalized', { status: record.status, outcome: record.outcome });
    save(root, record);
    saveMarkdown(root, record);
  }
}
