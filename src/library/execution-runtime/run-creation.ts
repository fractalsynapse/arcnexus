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
  /**
   * Refuses fan-out whose components own overlapping paths.
   *
   * N activations writing one checkout are only safe because each component writes inside its own
   * declared scope. Two components naming the same prefix would have both edit the same files in the
   * same tree with no ordering between them, and no clean-tree rule can detect that: the scopes
   * themselves collide. Ancestor and descendant naming counts as overlap, since owning `src/library`
   * and owning `src/library/x` write to the same directory.
   */
  private validateFanOutOverlay(stance: Extract<RunStance, { kind: 'component' }>): void {
    const held = Object.values(this.context.catalog.components).filter(
      (component) =>
        component.owns?.length &&
        (stance.activity ? component.activities?.[stance.activity] : true),
    );
    for (const [index, left] of held.entries())
      for (const right of held.slice(index + 1)) {
        const clash = (left.owns ?? []).find((a) => (right.owns ?? []).some((b) => overlaps(a, b)));
        if (clash)
          throw new InputError(
            `in-place fan-out cannot bound overlapping scopes: ${left.id} and ${right.id} both own ${clash}`,
          );
      }
  }

  /**
   * Guards an in-place run against the operator's own uncommitted work.
   *
   * Fan-out first proves its scopes do not overlap, then requires a strictly clean
   * checkout, because several components writing one tree cannot be bounded by path
   * inspection alone. A single named component may proceed over uncommitted work as
   * long as that work does not intersect what it owns.
   */
  private validateInPlace(stance: Extract<RunStance, { kind: 'component' }>): void {
    // Porcelain records are `XY path`, except renames and copies which are `XY source -> target`.
    // Both ends of a rename count: the destination is written even when the source sits outside the
    // component's scope, and a move out of scope still removes work the component owns.
    const dirty = porcelainPaths(
      git(this.context.source, 'status', '--untracked-files=all', '--porcelain'),
    );
    if (stance.fanOut) this.validateFanOutOverlay(stance);
    if (!dirty.length) return;
    if (stance.fanOut || !stance.component)
      throw new InputError('in-place work in progress; commit or stash');
    const owned = (this.context.catalog.components[stance.component]?.owns ?? []) as string[];
    const blocked = inPlaceIntersections(dirty, owned);
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

/**
 * Lists the paths a porcelain status block says are uncommitted, one entry per touched path.
 *
 * Records are `XY path`, except renames and copies (`XY source -> target`), where both ends count:
 * the destination is written even when the source lies outside a component's scope, and a move out
 * of scope still removes work the component owns.
 */
export function porcelainPaths(status: string): string[] {
  return status
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => (/^[RC]/.test(line) ? line.slice(3).split(' -> ') : [line.slice(3)]))
    .map(unquotePath);
}

/**
 * The uncommitted paths that fall inside a component's owned scopes.
 *
 * Scope comparison is separator-aware (see `overlaps`), so a dirty `src/application/x.ts` is not
 * mistaken for work inside `src/app`, and every owned scope counts - not only those under `src/` or
 * `tests/`. A component maintaining `docs/` or `AGENTS.md` has uncommitted work inside its own
 * scope just as much as one owning source, and admitting a run over it would let an activation
 * overwrite or duplicate that work in the shared checkout.
 */
export function inPlaceIntersections(dirty: string[], owned: string[]): string[] {
  return dirty.filter((path) => owned.some((scope) => overlaps(path, scope)));
}

/**
 * Returns a porcelain path as a filesystem path.
 *
 * Git quotes any path containing a space, so an unquoted comparison would treat "src/library/a
 * b.ts" as a different file from src/library/a and let in-place work overlap operator edits it was
 * supposed to refuse.
 */
function unquotePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
}

/**
 * True when two declared ownership scopes name the same files or nest inside one another.
 *
 * A whole-repository scope is written `.` in some projects and `./` in others; it overlaps every
 * other scope by definition, so it is matched before the prefix comparison rather than normalised
 * into one, which would turn the entire tree into the string `src/...`.
 */
export function overlaps(left: string, right: string): boolean {
  const a = left.replace(/^\.\//, '').replace(/\/$/, '') || '.';
  const b = right.replace(/^\.\//, '').replace(/\/$/, '') || '.';
  if (a === '.' || b === '.') return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
