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
    if (stance?.kind === 'component') this.validateInPlace(stance);
    else this.validateSource(simulate, workday);
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
  /**
   * Guards for in-place work, which deliberately writes in the operator's checkout.
   *
   * A fan-out stance would have several components writing the same tree, so it requires a strictly
   * clean checkout. One component may run over uncommitted operator work as long as that work does
   * not intersect what the component owns; the block message names the operator's own options,
   * because "Source checkout must be clean" describes a rule they never agreed to for in-place work.
   */
  private validateInPlace(stance: Extract<RunStance, { kind: 'component' }>): void {
    const dirty = git(this.context.source, 'status', '--porcelain', '--untracked-files=all')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
    if (!dirty.length) return;
    if (stance.fanOut || !stance.component)
      throw new InputError('in-place work in progress; commit or stash');
    const owned = (this.context.catalog.components[stance.component]?.owns ?? []).filter(
      (path: string) => path.startsWith('src/') || path.startsWith('tests/'),
    );
    const blocked = dirty.filter((path) => owned.some((scope: string) => path.startsWith(scope)));
    if (blocked.length)
      throw new InputError(
        `in-place work in progress; commit or stash (uncommitted paths inside ${stance.component}: ${blocked.join(', ')})`,
      );
  }

  /**
   * Requires an isolated, unchanging checkout for runs that build a separate candidate.
   *
   * A retained simulated workday may reuse its prepared environment, so the revision check follows
   * that environment's own base rather than the operator's current HEAD.
   */
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
