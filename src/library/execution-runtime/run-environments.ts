import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun, RunEnvironment } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import {
  assertRepositoryBinding,
  type RepositoryMaterialization,
} from '../architecture/bindings.js';
import { SimulationRepositories } from './simulation-repositories.js';

/** Captures external mode and materializes simulation repositories without replacing architectural authority. */
export class RunEnvironments {
  readonly directory: string;

  readonly effects: LifecycleStore;

  /** Opens host-private effect evidence under the existing canonical project identity. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {
    this.directory = join(root, 'projects', context.key, 'environments');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.effects = new LifecycleStore(join(root, 'projects', context.key, 'lifecycle.sqlite'));
  }

  /** Reuses a compatible workday environment while keeping different modes and authorities separate. */
  capture(simulate: boolean, workday?: ExecutionRun): RunEnvironment | undefined {
    const enabled = Object.values(this.context.catalog.operations).some(
      (op) => op.kind === 'upstream',
    );
    if (!enabled && !simulate) return undefined;
    if (!enabled) throw new Error('Simulation requires declared upstream lifecycle operations');
    const mode = simulate ? 'simulation' : 'live';
    const identity = executionIdentity(this.context);
    const id = this.reusable(mode, workday) ?? (simulate ? randomUUID() : `live-${identity}`);
    this.effects.register({
      id,
      mode,
      repositoryId: this.context.catalog.primaryRepository!,
      providerId: `${mode}-${id}`,
      authorityDigest: identity,
    });
    return { id, mode };
  }

  /** Returns the reusable environment only while its workday and captured authority are compatible. */
  reusable(mode: RunEnvironment['mode'], workday?: ExecutionRun): string | undefined {
    if (
      workday?.environment?.mode === mode &&
      ['running', 'idle', 'paused', 'pausing'].includes(workday.status) &&
      workday.data.executionIdentity === executionIdentity(this.context)
    )
      return workday.environment.id;
    return undefined;
  }

  /** Prepares isolated Git objects once; uncertain filesystem transitions require inspection, never replay. */
  async prepare(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    if (run.environment?.mode !== 'simulation') return;
    const directory = this.repository(run.environment);
    const prepared = this.store
      .runs()
      .find(
        (r) => r.environment?.id === run.environment!.id && r.data.environmentPrepared === true,
      );
    if (prepared) {
      this.contextFor(prepared);
      this.store.updateRun(run.id, run.status, {
        environmentPrepared: true,
        environmentRepositories: prepared.data.environmentRepositories,
      });
      return;
    }
    if (run.data.environmentPreparing || existsSync(directory))
      throw new Error('Simulation repository preparation is uncertain; inspect retained evidence');
    this.store.updateRun(run.id, run.status, { environmentPreparing: true });
    const parent = join(this.directory, run.environment.id);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const repositories = await new SimulationRepositories(this.context, parent).prepare(signal);
    this.store.updateRun(run.id, this.store.run(run.id).status, {
      environmentPreparing: false,
      environmentPrepared: true,
      environmentRepositories: repositories,
    });
    this.contextFor(this.store.run(run.id));
  }

  /** Supplies isolated source while retaining the same catalog, bindings, owner list and execution key. */
  contextFor(run: ExecutionRun): ProjectExecution {
    if (run.environment?.mode !== 'simulation') return this.context;
    const environment = this.effects.environment(run.environment.id);
    if (
      environment.mode !== 'simulation' ||
      environment.authorityDigest !== executionIdentity(this.context)
    )
      throw new Error('Simulation authority mismatch');
    const materializations = run.data.environmentRepositories as Record<
      string,
      RepositoryMaterialization
    >;
    if (!materializations) throw new Error('Missing captured simulation repository mapping');
    const bindings = {
      ...this.context.bindings,
      materializations,
      repositories: { ...this.context.bindings.repositories },
    };
    for (const [id, entry] of Object.entries(materializations)) {
      assertRepositoryBinding(entry.source, id, entry.repository, bindings);
      bindings.repositories[id] = entry.source;
    }
    const primary = materializations[this.context.catalog.primaryRepository!]!;
    return { ...this.context, source: primary.source, commonDir: primary.commonDir, bindings };
  }

  /** Resolves private paths from registered identities rather than worker input. */
  private repository(environment: RunEnvironment): string {
    this.effects.environment(environment.id);
    if (!/^[a-zA-Z0-9-]+$/.test(environment.id)) throw new Error('Unsafe environment identity');
    return join(this.directory, environment.id);
  }
}
