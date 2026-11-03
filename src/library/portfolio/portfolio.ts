import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';
import { RepositoryMaterializer } from './materialization.js';
import { ArchitectureValidation } from '../architecture/validation.js';
import { ConfigurationMigration } from '../architecture/migration.js';
import { existsSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { ExecutionContext } from '../architecture/execution-context.js';
import {
  PortfolioStore,
  type PortfolioRegistration,
  type PortfolioRepository,
  type RepositoryMaterialization,
} from '../coordination-store/portfolio-store.js';
import { ancestry, loadCatalog } from '../architecture/components.js';
import { loadProjectBindings } from '../architecture/bindings.js';
import { digest, resolveBase } from '../architecture/assignment.js';
import { InputError } from '../architecture/config.js';
import { git } from '../operations/process.js';
import { ApplicationSettings } from './settings.js';

export { ApplicationSettings } from './settings.js';

type Kind = PortfolioRegistration['kind'];

/** Resolves portfolio resources through committed architectural facts and stable repository registrations. */
export class Portfolio {
  private readonly store: PortfolioStore;

  /** Reads do not create storage; explicit mutating commands open transactional registration access. */
  constructor(
    readonly volume = new ApplicationSettings().get('volume').value,
    writable = false,
  ) {
    this.store = new PortfolioStore(join(volume, 'portfolio.sqlite'), writable);
  }

  /** Lists active resources with facts derived from source rather than duplicated database fields. */
  list(kind: Kind, platform?: string, query: ResourceQueryInput = {}) {
    const entries = this.store.registrations().filter((entry) => entry.kind === kind);
    const selected = platform
      ? entries.filter((entry) => entry.id.startsWith(platform + '/'))
      : entries;
    return new ResourceQuery().page(
      selected.map((entry) => this.view(entry)),
      { id: null, type: ['platform', 'package'], repositoryId: null },
      query,
      ['id', 'purpose'],
    );
  }

  /** Resolves qualified identity or a unique short reference without a mutable selected-project setting. */
  get(kind: Kind, reference: string) {
    return this.view(this.find(kind, reference));
  }

  /** Resolves a registered reference or local package without starting execution or changing directories. */
  packageTarget(reference?: string, cwd = process.cwd()) {
    if (reference !== undefined) {
      if (!reference.trim()) throw new InputError('Package reference must not be empty');
      const resource = this.get('package', reference);
      return {
        source: resource.source,
        base: resource.base,
        packageId: resource.id.split('/').at(-1)!,
      };
    }
    return this.localPackageTarget(cwd);
  }

  /** Applies the shared deepest-package rule to declarations physically belonging to this repository. */
  private localPackageTarget(cwd: string) {
    const { source, base } = resolveBase(cwd);
    const catalog = loadCatalog(source, base, loadProjectBindings(source));
    const local = {
      ...catalog,
      components: Object.fromEntries(
        Object.entries(catalog.components).filter(
          ([, component]) =>
            component.type !== 'package' || component.repository === catalog.primaryRepository,
        ),
      ),
    };
    const defaults = [
      ...new Set(
        Object.values(catalog.components)
          .filter((component) => component.type === 'platform' && component.defaultPackage)
          .map((component) => component.defaultPackage!),
      ),
    ];
    const selected = new ExecutionContext().selectPackage(
      local,
      relative(source, resolve(cwd)),
      defaults.length === 1 ? defaults[0] : undefined,
    );
    return { source, base, packageId: selected.id };
  }

  /** Validates the selected committed package source and tracked guidance without starting a host. */
  validate(reference: string) {
    const resource = this.get('package', reference);
    return new ArchitectureValidation().validate(
      resource.source,
      resource.base,
      loadProjectBindings(resource.source),
    );
  }

  /** Migrates local or registered source without requiring preceding configuration to be executable. */
  migrate(reference?: string, write = false, cwd = process.cwd()) {
    let source = cwd;
    let expectedBase: string | undefined;
    if (reference !== undefined) {
      const matches = this.store
        .registrations()
        .filter((entry) => entry.id === reference || entry.definitionId === reference);
      if (matches.length !== 1)
        throw new InputError('Unknown or ambiguous migration target: ' + reference);
      const selected = this.view(matches[0]!);
      source = selected.source;
      expectedBase = selected.base;
    }
    return new ConfigurationMigration(source).run(write, expectedBase);
  }

  /** Attaches local repositories or materializes supported remote URLs under supervised application ownership. */
  async create(kind: Kind, id: string, repository: string, signal: AbortSignal) {
    signal.throwIfAborted();
    this.identity(kind, id);
    if (existsSync(repository) || !repository.includes('://'))
      return this.register(kind, id, repository);
    const materializer = new RepositoryMaterializer(this.volume, this.store);
    const entry = await materializer.prepare(repository, signal);
    return this.attach(kind, id, join(this.volume, entry.location), entry);
  }

  /** Registers existing committed source without materialization or source mutation. */
  register(kind: Kind, id: string, path: string) {
    return this.attach(kind, id, path);
  }

  /** Attaches committed architecture without changing source, and serializes identity creation. */
  private attach(kind: Kind, id: string, path: string, managed?: RepositoryMaterialization) {
    this.identity(kind, id);
    const { source, base } = resolveBase(path);
    const catalog = loadCatalog(source, base, loadProjectBindings(source));
    const definitionId = id.split('/').at(-1)!;
    const component = catalog.components[definitionId];
    if (!component || component.type !== kind)
      throw new InputError('Missing declared ' + kind + ': ' + id);
    if (kind === 'package') {
      const platform = ancestry(catalog, definitionId).find((entry) => entry.type === 'platform');
      if (!platform || platform.id !== id.split('/')[0])
        throw new InputError('Package platform does not match its declaration');
      this.find('platform', platform.id);
    }
    return this.store.transaction('resource.registered', () => {
      if (managed?.status === 'ready')
        this.store.repository({
          id: managed.id,
          location: managed.location,
          managed: true,
        });
      const value = this.view(this.recordRegistration(kind, id, definitionId, source));
      if (managed?.status === 'ready')
        this.store.materialization({ ...managed, status: 'registered' });
      return value;
    });
  }

  /** Persists a validated registration, preserving identity on repeated attachment. */
  private recordRegistration(kind: Kind, id: string, definitionId: string, source: string) {
    const repository = this.repository(source);
    const previous = this.store
      .registrations(true)
      .find((item) => item.kind === kind && item.id === id);
    if (previous && previous.repositoryId !== repository.id)
      throw new Error('Resource already has a repository; use migrate');
    if (previous?.active) return previous;
    const value = {
      id,
      kind,
      repositoryId: repository.id,
      definitionId,
      active: true,
      revision: (previous?.revision ?? 0) + 1,
    };
    this.store.registration(value);
    return value;
  }

  /** Unregisters only inactive, unreferenced resources and retains repositories and evidence. */
  remove(kind: Kind, reference: string, expectedRevision?: string) {
    return this.store.transaction('resource.removed', () => {
      const entry = this.find(kind, reference);
      const view = this.view(entry);
      if (expectedRevision !== undefined && expectedRevision !== view.revision)
        throw new Error('Resource revision changed; read the current resource before retrying');
      if (
        kind === 'platform' &&
        this.store.registrations().some((item) => item.id.startsWith(entry.id + '/'))
      )
        throw new Error('Unregister platform packages first');
      this.assertInactive(view.source);
      this.store.registration({ ...entry, active: false, revision: entry.revision + 1 });
      return { id: entry.id, status: 'unregistered', retainedRepository: view.source };
    });
  }

  /** Rejects ambiguous or missing registrations before any lifecycle mutation. */
  private find(kind: Kind, reference: string): PortfolioRegistration {
    const entries = this.store.registrations().filter((entry) => entry.kind === kind);
    const exact = entries.find((entry) => entry.id === reference);
    if (exact) return exact;
    const candidates = entries.filter((entry) => entry.definitionId === reference);
    if (candidates.length !== 1)
      throw new InputError('Unknown or ambiguous ' + kind + ': ' + reference);
    return candidates[0]!;
  }

  /** Derives policy and identity from the current committed source while reporting an optimistic revision token. */
  private view(entry: PortfolioRegistration) {
    const repository = this.store.repositories().find((item) => item.id === entry.repositoryId);
    if (!repository) throw new Error('Missing registered repository: ' + entry.repositoryId);
    const location = repository.managed
      ? join(this.volume, repository.location)
      : repository.location;
    const { source, base } = resolveBase(location);
    const catalog = loadCatalog(source, base, loadProjectBindings(source));
    const definition = catalog.components[entry.definitionId];
    if (!definition || definition.type !== entry.kind)
      throw new Error('Registered definition changed; reconcile architecture');
    return {
      id: entry.id,
      type: entry.kind,
      repositoryId: repository.id,
      source,
      base,
      revision: digest(JSON.stringify([entry.revision, repository.id, base])),
      purpose: definition.purpose,
      ...(definition.definition ? { definition: definition.definition } : {}),
      managed: repository.managed,
    };
  }

  /** Deduplicates linked worktrees by canonical Git identity, rejecting different selected source revisions. */
  private repository(source: string): PortfolioRepository {
    const common = this.common(source);
    const existing = this.store.repositories().find((entry) => {
      const location = entry.managed ? join(this.volume, entry.location) : entry.location;
      return this.common(location) === common;
    });
    if (existing) {
      const location = existing.managed ? join(this.volume, existing.location) : existing.location;
      if (resolveBase(location).base !== resolveBase(source).base)
        throw new Error('Linked checkout has different authority; use the registered source');
      return existing;
    }
    const repository = { id: randomUUID(), location: source, managed: false };
    this.store.repository(repository);
    return repository;
  }

  /** Captures the canonical local repository identity independently of linked checkout paths. */
  private common(source: string): string {
    return realpathSync(
      git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
  }

  /** Enforces explicit namespaces and excludes path-like or ambiguous registry keys. */
  private identity(kind: Kind, id: string): void {
    const parts = id.split('/');
    if (
      parts.length !== (kind === 'platform' ? 1 : 2) ||
      parts.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part))
    )
      throw new InputError(
        'Expected ' + (kind === 'platform' ? 'platform identity' : 'platform/package identity'),
      );
  }

  /** Checks managed and local-development stores without starting a host or replaying execution. */
  private assertInactive(source: string): void {
    const key = digest(this.common(source)).slice(0, 24);
    for (const root of new ApplicationSettings().executionRoots(this.volume))
      if (PortfolioStore.activeExecution(join(root, 'projects', key, 'execution.sqlite')))
        throw new Error('Stop or reconcile active repository execution before unregistering');
  }

  /** Releases persistence resources after a CLI command or application request finishes. */
  close(): void {
    this.store.close();
  }
}
