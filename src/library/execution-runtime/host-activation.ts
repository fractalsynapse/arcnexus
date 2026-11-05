import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionReports } from '../report/report.js';

/** Serializes managed activation and drains it before a supervisor releases durable execution ownership. */
export class HostActivation {
  current?: { runId: string; controller: AbortController };

  closing = false;

  private pending?: Promise<void>;

  /** Exposes active execution without treating queued work or an idle workday as a running subprocess. */
  get busy(): boolean {
    return this.current !== undefined;
  }

  /** Admits one activation and releases its in-memory identity only after all owned work settles. */
  async run(id: string, execute: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.closing || this.current) return;
    const controller = new AbortController();
    this.current = { runId: id, controller };
    this.pending = execute(controller.signal);
    try {
      await this.pending;
    } finally {
      this.current = undefined;
      this.pending = undefined;
    }
  }

  /** Stops admission, drains cancellation and records host interruption without converting it into user stop. */
  async shutdown(store: ExecutionStore, reports: ExecutionReports): Promise<void> {
    this.closing = true;
    const ids = store
      .runs()
      .filter((run) => ['running', 'idle', 'pausing'].includes(run.status))
      .map((run) => run.id);
    this.current?.controller.abort(new Error('Execution host is shutting down'));
    await this.pending;
    for (const id of ids) {
      const run = store.run(id);
      if (['completed', 'cancelled', 'stopped', 'paused', 'needs_input'].includes(run.status))
        continue;
      store.updateRun(id, 'interrupted', {
        hostInterruptedAt: new Date().toISOString(),
        executionOwner: false,
      });
      reports.save(id);
    }
  }
}
