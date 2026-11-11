import type { RunStance } from '../coordination-store/execution-types.js';
import { InputError } from '../architecture/config.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionRun, RunMode } from '../coordination-store/execution-types.js';
import { executionIdentity } from '../architecture/execution-context.js';
import { git } from '../operations/process.js';
import type { RunEnvironments } from './run-environments.js';

/** Captures a clean committed goal and an environment-specific verified baseline. */
export class RunCreation {
  /** Uses the host's frozen authority and existing durable stores. */
  constructor(
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
    private readonly environments: RunEnvironments,
  ) {}

  /** Creates a distinct run without allowing simulated candidates into live baselines. */
  create(
    mode: RunMode,
    objective: string,
    simulate: boolean,
    workday?: ExecutionRun,
    stance?: RunStance,
  ): ExecutionRun {
    this.validateSource(simulate, workday);
    const environment = this.environments.capture(simulate, workday);
    const candidate = this.store.latestDelivery(
      this.context.base,
      this.context.packageId,
      environment,
    );
    const run = this.store.createRun(mode, this.context.owners, objective, environment);
    this.store.updateRun(run.id, 'running', {
      candidateRevision: candidate?.data.candidateRevision ?? this.context.base,
      authorityBase: this.context.base,
      executionIdentity: executionIdentity(this.context),
      packageId: this.context.packageId,
      ...(stance ? { stance } : {}),
    });
    return this.store.run(run.id);
  }

  /** Checks the caller only for new environments; a joined simulation validates its isolated source. */
  private validateSource(simulate: boolean, workday?: ExecutionRun): void {
    const isolated =
      simulate &&
      workday?.data.environmentPrepared &&
      this.environments.reusable('simulation', workday);
    const context = isolated ? this.environments.contextFor(workday!) : this.context;
    const expected = isolated ? context.base : (context.checkoutAtCapture ?? context.base);
    if (git(context.source, 'status', '--porcelain', '--untracked-files=all').trim())
      throw new InputError('Source checkout must be clean when creating a new run');
    if (git(context.source, 'rev-parse', 'HEAD').trim() !== expected)
      throw new InputError('Source revision changed; stop and start against updated authority');
  }
}
