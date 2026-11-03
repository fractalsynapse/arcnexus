import { randomUUID } from 'node:crypto';
import type { ExecutionDatabase } from './execution-database.js';
import type { ExecutionRun, RunEnvironment, RunMode } from './execution-types.js';

/** Creates immutable run identities without conflating task policy with external environment mode. */
export class RunRecords {
  /** Uses the existing project database and ordered event stream. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Captures the complete eligible catalog and optional environment once for a new run. */
  create(
    mode: RunMode,
    owners: string[],
    objective: string,
    environment?: RunEnvironment,
  ): ExecutionRun {
    this.validate(owners, environment);
    const run: ExecutionRun = {
      id: randomUUID(),
      mode,
      owners,
      objective,
      status: 'running',
      createdAt: new Date().toISOString(),
      data: {},
      ...(environment ? { environment: structuredClone(environment) } : {}),
    };
    return this.db.transaction('run.created', run, () => {
      this.db.put('run', run);
      return this.db.get('run', run.id);
    });
  }

  /** Rejects empty catalog and malformed external identity before any run or event is created. */
  private validate(owners: string[], environment?: RunEnvironment): void {
    if (!owners.length || new Set(owners).size !== owners.length)
      throw new Error('Invalid eligible owners');
    if (
      environment &&
      (!environment.id.trim() ||
        environment.id.includes('\0') ||
        !['live', 'simulation'].includes(environment.mode))
    )
      throw new Error('Invalid captured run environment');
  }
}
