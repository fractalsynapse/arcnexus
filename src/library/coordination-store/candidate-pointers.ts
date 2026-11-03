import type { ExecutionDatabase } from './execution-database.js';
import type { ExecutionRun, RunEnvironment } from './execution-types.js';

/** Keeps verified candidate pointers isolated by captured execution environment. */
export class CandidatePointers {
  /** Shares the assignment transaction so delivery and candidate selection cannot diverge. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Promotes within the run's immutable environment; legacy records retain their original key. */
  promote(runId: string, candidate: Record<string, unknown>): void {
    const run = this.db.get<ExecutionRun>('run', runId);
    this.db.put('candidate', {
      id: this.key(run.data.authorityBase, run.data.packageId, run.environment),
      runId,
    });
    this.db.put('run', {
      ...run,
      data: { ...run.data, ...candidate, promotedAt: new Date().toISOString() },
    });
  }

  /** Returns only the latest verified candidate from the requested environment. */
  latest(
    authorityBase: string,
    packageId: string,
    environment?: RunEnvironment,
  ): ExecutionRun | undefined {
    const id = this.key(authorityBase, packageId, environment);
    const pointer = this.db
      .all<{ id: string; runId: string }>('candidate')
      .find((p) => p.id === id);
    return pointer ? this.db.get('run', pointer.runId) : undefined;
  }

  /** Distinguishes same-mode environments as well as live versus simulated candidates. */
  private key(base: unknown, packageId: unknown, environment?: RunEnvironment): string {
    return JSON.stringify(
      environment ? [base, packageId, environment.mode, environment.id] : [base, packageId],
    );
  }
}
