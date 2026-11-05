import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, resolveBase } from '../architecture/assignment.js';
import { loadProjectBindings } from '../architecture/bindings.js';
import { ancestry, loadCatalog } from '../architecture/components.js';
import { InputError } from '../architecture/config.js';
import { ArchitectureValidation } from '../architecture/validation.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import {
  PortfolioStore,
  type PortfolioRegistration,
  type RepositoryMaterialization,
} from '../coordination-store/portfolio-store.js';
import { git } from '../operations/process.js';
import { RepositoryMaterializer } from './materialization.js';
import { ApplicationSettings } from './settings.js';

interface MigrationSource {
  source: string;
  base: string;
  revision: string;
  repositoryId: string;
}

/** Transfers one registration to compatible managed source without mutating either checkout or upstream. */
export class RepositoryMigration {
  /** Reuses the portfolio transaction boundary and existing supervised materialization journal. */
  constructor(
    private readonly volume: string,
    private readonly store: PortfolioStore,
  ) {}

  /** Leases source execution before reading remote data and rejects stale authority before any transfer. */
  async run(
    entry: PortfolioRegistration,
    source: MigrationSource,
    target: string,
    signal: AbortSignal,
    expectedRevision?: string,
  ): Promise<void> {
    signal.throwIfAborted();
    if (expectedRevision !== undefined && expectedRevision !== source.revision)
      throw new InputError('Resource revision changed; read the current resource before retrying');
    const lease = this.lease(source.source);
    try {
      this.assertInactive(source.source, source.repositoryId);
      const sourceBase = resolveBase(source.source).base;
      const remote = existsSync(target) ? pathToFileURL(resolve(target)).href : target;
      const destination = await new RepositoryMaterializer(this.volume, this.store).prepare(
        remote,
        signal,
      );
      signal.throwIfAborted();
      this.transfer(entry, source, sourceBase, destination);
    } finally {
      lease.close();
    }
  }

  /** Holds destination ownership during validation and atomic registration; same-repository retries reuse the lease. */
  private transfer(
    entry: PortfolioRegistration,
    source: MigrationSource,
    sourceBase: string,
    destination: RepositoryMaterialization,
  ): void {
    const target = join(this.volume, destination.location);
    const lease =
      this.common(target) === this.common(source.source) ? undefined : this.lease(target);
    try {
      this.assertInactive(target, destination.id);
      const base = this.validate(entry, source, destination);
      this.store.transaction('resource.migrated', () => {
        this.assertCurrent(entry, source, sourceBase);
        if (resolveBase(target).base !== base)
          throw new Error('Migration destination changed during validation');
        this.select(entry, destination);
      });
    } finally {
      lease?.close();
    }
  }

  /** Requires clean committed destination history and the same architectural identity before selection. */
  private validate(
    entry: PortfolioRegistration,
    source: MigrationSource,
    destination: RepositoryMaterialization,
  ): string {
    const target = join(this.volume, destination.location);
    const base = this.checkpoint(target, destination);
    this.history(target, source.base, base);
    const bindings = loadProjectBindings(target);
    const catalog = loadCatalog(target, base, bindings);
    const component = catalog.components[entry.definitionId];
    if (!component || component.type !== entry.kind)
      throw new InputError('Migration destination does not preserve the registered definition');
    if (
      entry.kind === 'package' &&
      ancestry(catalog, entry.definitionId).find((value) => value.type === 'platform')?.id !==
        entry.id.split('/')[0]
    )
      throw new InputError('Migration destination changes the package platform');
    if (new ArchitectureValidation().validate(target, base, bindings).status !== 'valid')
      throw new InputError('Migration destination guidance validation failed');
    return base;
  }

  /** Verifies retained clone bytes and binding rather than treating a registered receipt as fresh proof. */
  private checkpoint(target: string, destination: RepositoryMaterialization): string {
    const { base } = resolveBase(target);
    if (
      base !== destination.base ||
      git(target, 'status', '--porcelain', '--untracked-files=all').trim()
    )
      throw new Error('Migration destination differs from its recorded clone checkpoint');
    if (git(target, 'remote', 'get-url', 'origin').trim() !== destination.remote)
      throw new Error('Migration destination origin differs from its clone receipt');
    const registered = this.store.repositories().find((value) => value.id === destination.id);
    if (registered?.authority && registered.authority.base !== base)
      throw new Error(
        'Destination has separately selected configuration; reconcile before migration',
      );
    return base;
  }

  /** Rejects divergent or behind remotes instead of dropping selected configuration or publishing implicitly. */
  private history(target: string, previous: string, next: string): void {
    try {
      git(target, 'merge-base', '--is-ancestor', previous, next);
    } catch {
      throw new InputError(
        'Destination does not contain selected authority; reconcile repository history before migration',
      );
    }
  }

  /** Detects out-of-band source or registry changes even while cooperative repository owners are leased. */
  private assertCurrent(
    entry: PortfolioRegistration,
    source: MigrationSource,
    sourceBase: string,
  ): void {
    const current = this.store
      .registrations()
      .find((value) => value.kind === entry.kind && value.id === entry.id);
    const repository = this.store.repositories().find((value) => value.id === entry.repositoryId);
    if (
      JSON.stringify(current) !== JSON.stringify(entry) ||
      resolveBase(source.source).base !== sourceBase ||
      (repository?.authority?.base ?? sourceBase) !== source.base
    )
      throw new Error(
        'Source or registration changed during migration; read current resource before retrying',
      );
  }

  /** Commits location, registration revision and clone receipt together; successful retries preserve revisions. */
  private select(entry: PortfolioRegistration, destination: RepositoryMaterialization): void {
    if (entry.repositoryId === destination.id) return;
    if (!this.store.repositories().some((value) => value.id === destination.id))
      this.store.repository({ id: destination.id, location: destination.location, managed: true });
    this.store.registration({
      ...entry,
      repositoryId: destination.id,
      revision: entry.revision + 1,
    });
    this.store.materialization({ ...destination, status: 'registered' });
  }

  /** Rejects unfinished configuration transitions and executions without starting or changing their hosts. */
  private assertInactive(source: string, repositoryId: string): void {
    if (
      this.store
        .mutations()
        .some((entry) => entry.repositoryId === repositoryId && entry.status === 'pending')
    )
      throw new Error('Reconcile pending configuration transition before migration');
    const key = digest(this.common(source)).slice(0, 24);
    for (const root of new ApplicationSettings().executionRoots(this.volume))
      if (PortfolioStore.activeExecution(join(root, 'projects', key, 'execution.sqlite')))
        throw new Error('Stop or reconcile active repository execution before migration');
  }

  /** Shares the canonical repository lease with execution hosts and architecture mutations. */
  private lease(source: string): ExecutionLease {
    return new ExecutionLease(join(this.common(source), 'arcnexus', 'host.lease.sqlite'));
  }

  /** Resolves linked checkouts to their single Git administration directory. */
  private common(source: string): string {
    return realpathSync(
      git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
  }
}
