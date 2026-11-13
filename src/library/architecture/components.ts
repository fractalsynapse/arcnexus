import { PublicApiCatalog } from './public-api.js';
import { normalizeOperation } from '../operations/operation-definition.js';
import { ComponentOperationPlans } from './component-operation-plans.js';
import { requireActivity } from './activities.js';
import { ancestry, covered, scopePath } from './component-paths.js';
import { ComponentMaterializer } from './component-materialization.js';
import type { ComponentFields } from './component-fields.js';
import type { MaterializedComponentFields } from './component-materialization-policy.js';
import { captureComponentTests } from '../testing/captured-tests.js';
import { repositoryRevisions, type RepositoryRevision } from './repository-revisions.js';
import type { Bindings } from './bindings.js';
import { ArchitectureReferences } from './references.js';
import { validateInitialization } from './initialization.js';
import type { Operation } from '../operations/operations.js';
import { git } from '../operations/process.js';
import {
  commands,
  environment,
  InputError,
  type VerificationCheck,
  type Environment,
} from './config.js';
import { ConfigurationReader, isConfiguration, type ConfigurationSource } from './configuration.js';
import { OwnershipValidator } from './ownership.js';
import { validateSchema } from './schema.js';

/** Resolved read scope for a component: its own declared reads plus inherited ones.
 *
 * Writing is not modelled here. A component's `owns` is the only statement of what it may
 * write, so there is no second grant to keep in step with it.
 */
export interface AccessPolicy {
  readPaths: string[];
}

export { componentContext, catalogContext } from './model-context.js';

export { ancestry, covered, scopePath } from './component-paths.js';

export { classifyComponentPath } from './file-classification.js';

export interface Component extends ComponentFields, MaterializedComponentFields {
  initialization?: { schemaVersion: 3; componentId: string };
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  operationIds?: string[];
  id: string;
  type: string;
  repository: string;
  purpose: string;
  path: string;
  objectives: string[];
  constraints: string[];
  access: AccessPolicy;
  allowedWritePaths: string[];
  verification: VerificationCheck[];
  parentId?: string;
  questions: string[];
  patterns: string[];
  interfaces: string[];
  documentation: string[];
  tests: string[];
  relatedIds: string[];
  activities: Record<string, ComponentActivity>;
  executionProfile: string;
  members?: {
    foundations: string[];
    dependencies: string[];
    gateways: string[];
    libraries: string[];
    releases: string[];
  };
}

export interface Role {
  schemaVersion: 4;
  id: string;
  purpose: string;
  responsibilities: string[];
  instructions?: string[];
  standards?: string[];
  executionProfile?: string;
}

/** One activity as configured by a component: the role holding it, its local direction and its operations. */
export interface ComponentActivity {
  role: string;
  instructions?: string[];
  profile?: string;
  operations?: ActivityOperation[];
  /** Standards this activity declares for itself, joined to the component's and the position's. */
  standards?: string[];
}

export type ActivityOperation =
  string | { id: string; usage?: string; with?: Record<string, unknown> };

export interface ExecutionProfile {
  schemaVersion: 1 | 2 | 3;
  id: string;
  model: string;
  reasoning: 'low' | 'medium' | 'high';
  webSearch: 'live' | 'disabled';
  timeoutSeconds?: number;
  commandTimeoutSeconds?: number;
  operationCategories?: string[];
  maxOperationCalls?: number;
  maxTurns?: number;
  maxCorrectiveTurns?: number;
  maxChecklistCalls?: number;
  maxAttempts?: number;
}

export interface CompositionProfile {
  schemaVersion: 1 | 3;
  id: string;
  platformId: string;
  packageIds: string[];
}

export interface Catalog {
  standards?: ReturnType<ArchitectureReferences['standards']>;
  primaryRepository?: string;
  repositoryRevisions?: Record<string, RepositoryRevision>;
  configurationSources: ConfigurationSource[];
  operations: Record<string, Operation>;
  compositions: Record<string, CompositionProfile>;
  components: Record<string, Component>;
  roles: Record<string, Role>;
  profiles: Record<string, ExecutionProfile>;
}

export function validateOperations(
  operations: Operation[],
  profile: ExecutionProfile,
  env: Environment,
): void {
  for (const op of operations) {
    if (!profile.operationCategories?.includes(op.category))
      throw new InputError('Operation category not permitted by execution profile: ' + op.id);
    const outputs =
      env.workspace && op.repository !== env.workspace.primary.id
        ? (env.workspace.dependencies.find((member) => member.id === op.repository)
            ?.generatedDirectories ?? [])
        : env.generatedDirectories;
    for (const path of op.generatedDirectories)
      if (!outputs.includes(path))
        throw new InputError('Operation generated directory is not declared disposable: ' + path);
    if (
      op.kind === 'http' &&
      !operations.some((service) => service.id === op.http.serviceId && service.kind === 'service')
    )
      throw new InputError('HTTP operation requires a declared service in assignment scope');
  }
}

function read<T>(
  repository: string,
  base: string,
  path: string,
  schema: string,
  sources: ConfigurationSource[],
): T {
  const source = new ConfigurationReader().revision(repository, base, path);
  sources.push(source);
  try {
    return validateSchema<T>(
      // One schema per kind, named for the kind: there is no version to select between, so a
      // document written in an older shape fails validation rather than being upgraded by the loader.
      schema,
      structuredClone(source.value),
    );
  } catch (error) {
    throw new InputError(`${path}: ${String(error)}`);
  }
}

export function loadCatalog(repository: string, base: string, bindings?: Bindings): Catalog {
  try {
    return new CatalogLoader(repository, base, bindings).load();
  } catch (error) {
    // A rejected catalog is an input problem, but an unexpected internal failure is not: keeping the
    // original error as the cause preserves the frame that names the statement which failed. Flattening
    // it into a message is what made several fixture crashes impossible to attribute from output alone.
    if (error instanceof InputError) throw error;
    throw new InputError(String(error), { cause: error });
  }
}

/** Loads revision-pinned definitions and resolves their cross-component references. */
class CatalogLoader {
  readonly catalog: Catalog = {
    configurationSources: [],
    operations: {},
    compositions: {},
    components: {},
    roles: {},
    profiles: {},
  };

  private readonly paths: string[];

  /** Inventories architecture files at the fixed Git revision without reading candidate edits. */
  constructor(
    private readonly repository: string,
    private readonly base: string,
    private readonly bindings?: Bindings,
  ) {
    this.paths = git(repository, 'ls-tree', '-r', '--name-only', base, '--', 'architecture')
      .split('\n')
      .sort();
  }

  /** Loads all catalog definitions before validating cross-references. */
  load(): Catalog {
    this.definitions();
    for (const path of this.files('operations')) this.operation(path);
    const source = new ConfigurationReader().definition(
      this.repository,
      this.base,
      '.arc/architecture/environment',
    );
    this.catalog.configurationSources.push(source);
    const env = environment(source.value, Object.values(this.catalog.operations));
    repositoryRevisions(this.catalog, env, this.repository, this.base, this.bindings);
    new ComponentMaterializer(this.catalog).resolve();
    if (!Object.keys(this.catalog.components).length) throw new InputError('No components defined');
    const validator = new CatalogComponentValidator(this.catalog, env);
    for (const component of Object.values(this.catalog.components)) validator.validate(component);
    validateInitialization(this.catalog);
    captureComponentTests(this.catalog, this.repository, this.base);
    new ComponentOperationPlans(this.catalog).resolve();
    new ArchitectureReferences(this.repository, this.base, this.catalog).resolve();
    for (const path of this.files('composition-profiles')) this.composition(path);
    this.ownership();
    new PublicApiCatalog(this.catalog).resolve();
    return this.catalog;
  }

  /** Validates exact maintained-source ownership against the captured tree after resolution. */
  private ownership(): void {
    const ownership = new OwnershipValidator(this.repository, this.base).validate(this.catalog);
    if (ownership) this.catalog.configurationSources.push(ownership);
    this.boundOwnership();
  }

  /** Applies exact minimal ownership to every captured binding without reinterpreting historical catalogs. */
  private boundOwnership(): void {
    for (const [id, revision] of Object.entries(this.catalog.repositoryRevisions ?? {})) {
      if (id === this.catalog.primaryRepository) continue;
      new OwnershipValidator(revision.source, revision.base).validate({
        ...this.catalog,
        primaryRepository: id,
      });
    }
  }

  /** Enumerates supported definition files in the captured repository revision. */
  private files(directory: string): string[] {
    return this.paths.filter(
      (path) => path.startsWith(`.arc/architecture/${directory}/`) && isConfiguration(path),
    );
  }

  /** Parses and schema-validates each declared catalog definition. */
  private definitions(): void {
    const { catalog, repository, base, paths } = this;
    const groups = [
      ['components', 'component', catalog.components],
      ['roles', 'role', catalog.roles],
      ['execution-profiles', 'execution-profile', catalog.profiles],
    ] as const;
    for (const [directory, schema, target] of groups)
      for (const path of paths.filter(
        (p) => p.startsWith(`.arc/architecture/${directory}/`) && isConfiguration(p),
      )) {
        const value = read<Record<string, unknown>>(
          repository,
          base,
          path,
          schema,
          catalog.configurationSources,
        );
        this.define(target, schema, directory, path, value);
      }
  }

  /** Registers one parsed definition after checking identity and vocabulary. */
  private define(
    target: Record<string, unknown>,
    schema: string,
    directory: string,
    path: string,
    value: Record<string, unknown>,
  ): void {
    const id = String(value.id);
    const legacy = Number(value.schemaVersion) < 5;
    if (legacy && path.replace(/\.(json|ya?ml)$/, '') !== `.arc/architecture/${directory}/${id}`)
      throw new InputError(`Identity must match filename: ${path}`);
    if (Object.hasOwn(target, id)) throw new InputError(`Duplicate definition: ${id}`);
    value.id = id;
    Object.defineProperty(target, id, {
      value: value as unknown as Component & Role & ExecutionProfile,
      enumerable: true,
      configurable: true,
    });
  }

  /** Loads a referenced operation without granting it to unrelated owners. */
  private operation(path: string): void {
    const { catalog, repository, base } = this;
    const operation = normalizeOperation(
      read<Operation>(repository, base, path, 'operation', catalog.configurationSources),
    );
    if (path.replace(/\.(json|ya?ml)$/, '') !== `.arc/architecture/operations/${operation.id}`)
      throw new InputError('Operation identity must match filename');
    scopePath(operation.cwd);
    operation.generatedDirectories.forEach(scopePath);
    operation.artifacts.forEach(scopePath);
    operation.dependencyInputs?.forEach(scopePath);
    commands([
      ...(['http', 'upstream'].includes(operation.kind) ? [] : [operation]),
      ...operation.probes,
    ]);
    if (Object.hasOwn(catalog.operations, operation.id))
      throw new InputError('Duplicate operation: ' + operation.id);
    Object.defineProperty(catalog.operations, operation.id, {
      value: operation,
      enumerable: true,
    });
  }

  /** Resolves declared package selection independently of ownership parents. */
  private composition(path: string): void {
    const { catalog, repository, base } = this;
    const profile = read<CompositionProfile>(
      repository,
      base,
      path,
      'composition-profile',
      catalog.configurationSources,
    );
    if (
      path.replace(/\.(json|ya?ml)$/, '') !==
        `.arc/architecture/composition-profiles/${profile.id}` ||
      catalog.components[profile.platformId]?.type !== 'platform'
    )
      throw new InputError('Invalid composition platform');
    if (Object.hasOwn(catalog.compositions, profile.id))
      throw new InputError('Duplicate composition: ' + profile.id);
    Object.defineProperty(catalog.compositions, profile.id, { value: profile, enumerable: true });
    for (const id of profile.packageIds)
      if (
        catalog.components[id]?.type !== 'package' ||
        catalog.components[id]?.parentId !== profile.platformId
      )
        throw new InputError(`Invalid composition package: ${id}`);
  }
}

/** Checks catalog relationships, scopes and operation compatibility before inference. */
class CatalogComponentValidator {
  /** Retains the resolved catalog and environment for cross-definition compatibility checks. */
  constructor(
    private readonly catalog: Catalog,
    private readonly env: Environment,
  ) {}

  /** Rejects inputs that violate the captured configuration contract. */
  validate(c: Component): void {
    this.paths(c);
    this.operations(c);
    this.ancestors(c);
    this.related(c);
    this.members(c);
  }

  /** Validates the component’s paths before they can become execution scope. */
  private paths(c: Component): void {
    scopePath(c.path);
    for (const p of [...c.allowedWritePaths, ...c.documentation, ...c.tests]) scopePath(p);
    commands(c.verification);
  }

  /** Checks referenced operations against the component profile and environment. */
  private operations(c: Component): void {
    const { catalog, env } = this;
    if (['platform', 'package'].includes(c.type)) return;
    const ids = Object.keys(c.operations ?? {});
    for (const id of ids) {
      const op = catalog.operations[id];
      if (!Object.hasOwn(catalog.operations, id) || op?.repository !== c.repository)
        throw new InputError('Missing operation or conflicting repository owner: ' + id);
      if (!c.activities || !Object.keys(c.activities).length)
        throw new InputError(`Component declares no activities: ${c.id}`);
    }
    if (!Object.hasOwn(catalog.profiles, c.executionProfile))
      throw new InputError(`Missing execution profile for ${c.id}`);
    this.declaredActivities(c, catalog);
    // A leaf may bind operations to activities without declaring any of its own; reading the map
    // defensively keeps that shape a validation result rather than an internal crash.
    const profiles = Object.values(c.activities ?? {}).flatMap((a) =>
      a.profile ? [a.profile] : [],
    );
    for (const id of [c.executionProfile, ...profiles]) {
      if (!Object.hasOwn(catalog.profiles, id))
        throw new InputError(`Unknown activity execution profile for ${c.id}: ${id}`);
      validateOperations(
        ids.map((id) => catalog.operations[id]!),
        catalog.profiles[id]!,
        env,
      );
    }
  }

  /** Requires each declared activity to name a real role; the activity is chosen here, not by the role. */
  private declaredActivities(c: Component, catalog: Catalog): void {
    for (const [declared, config] of Object.entries(c.activities ?? {})) {
      const activity = requireActivity(declared, `component ${c.id}`);
      const role = catalog.roles[config.role];
      if (!role) throw new InputError(`Unknown role for ${c.id}.${activity}: ${config.role}`);
      for (const entry of config.operations ?? []) {
        const id = typeof entry === 'string' ? entry : entry.id;
        if (!Object.hasOwn(c.operations ?? {}, id))
          throw new InputError(
            `Activity operation not declared by component: ${c.id}.${activity}: ${id}`,
          );
      }
    }
  }

  /** Checks inherited constraints across the complete parent chain. */
  private ancestors(c: Component): void {
    const { catalog } = this;
    const ancestors = ancestry(catalog, c.id).slice(0, -1);
    const parent = ancestors.at(-1);
    if (c.type === 'platform' && parent) throw new InputError('Platform cannot have an owner');
    if (parent && c.type === 'package' && parent.type !== 'platform')
      throw new InputError('Package owner must be a platform');
    if (parent && c.type !== 'package' && c.repository !== parent.repository)
      throw new InputError(`Conflicting repository ownership: ${c.id}`);
    for (const a of ancestors.filter((entry) => entry.repository === c.repository)) {
      // Ownership is the only write authority, so widening is judged against it alone. A container
      // declares no scope of its own, which widens nothing and cannot be violated.
      if (!a.allowedWritePaths.length) continue;
      if (c.allowedWritePaths.some((p) => !covered(p, a.allowedWritePaths)))
        throw new InputError(`Child widens ancestor authority: ${c.id}`);
    }
  }

  /** Validates context relationships without adding write authority. */
  private related(c: Component): void {
    const { catalog } = this;
    for (const id of c.relatedIds)
      if (!Object.hasOwn(catalog.components, id))
        throw new InputError(`Missing related component: ${id}`);
    if (c.type === 'package' && !c.members)
      throw new InputError(`Package requires member declarations: ${c.id}`);
  }

  /** Checks package membership and referenced component identities. */
  private members(c: Component): void {
    const { catalog } = this;
    if (c.members) {
      if (c.type !== 'package') throw new InputError('Only packages declare members');
      for (const [kind, ids] of Object.entries(c.members))
        for (const id of ids) {
          const member = Object.hasOwn(catalog.components, id) ? catalog.components[id] : undefined;
          if (
            !member ||
            (kind !== 'dependencies' && member.parentId !== c.id) ||
            (['foundations', 'gateways', 'libraries'].includes(kind) &&
              member.type !==
                (
                  {
                    foundations: 'foundation',
                    gateways: 'gateway',
                    libraries: 'library',
                  } as Record<string, string>
                )[kind])
          )
            throw new InputError(`Invalid ${kind} member: ${id}`);
        }
    }
  }
}

export function loadContext(repository: string, base: string, id: string): Component[] {
  return ancestry(loadCatalog(repository, base), id);
}
