import { OwnershipValidator } from './ownership.js';
import { ComponentOperationPlans } from './component-operation-plans.js';
import { validateOwnerWorkflow } from './assignment-scope.js';
import { captureInitialization, type InitializationSnapshot } from './initialization.js';
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { Operation } from '../operations/operations.js';
import { git } from '../operations/process.js';
import { resolveMembers, type Member } from '../workspace/members.js';
import { loadBindings, type Bindings } from './bindings.js';
import {
  ancestry,
  loadCatalog,
  validateOperations,
  type Component,
  type Catalog,
  type CompositionProfile,
  type ExecutionProfile,
  type Role,
} from './components.js';
import {
  commands,
  environment,
  InputError,
  type Command,
  type VerificationCheck,
  type Environment,
} from './config.js';
import { ConfigurationReader } from './configuration.js';
import { validateSchema } from './schema.js';

export interface HostCheck extends Command {
  id: string;
  artifacts: string[];
}

export interface PriorEvidence {
  path: string;
  sourceId: string;
  revision: string;
  reason: string;
}

export interface EvidenceSnapshot extends PriorEvidence {
  sha256: string;
  bytes: number;
  content: string;
}

export interface Assignment {
  priorEvidence?: PriorEvidence[];
  schemaVersion: 1 | 2 | 3;
  operationIds?: string[];
  objective: string;
  kind: 'change' | 'research' | 'review';
  expectedOutcome: string;
  changeType?: 'behavior' | 'documentation' | 'refactor';
  acceptanceCriteria: string[];
  hostChecks: HostCheck[];
}

export interface ResolvedAssignment {
  initialization: InitializationSnapshot;
  configurationSources?: import('./configuration.js').ConfigurationSource[];
  schemaVersion: 1;
  priorEvidence: EvidenceSnapshot[];
  operations: Operation[];
  environment: Environment;
  workspaceMembers: Omit<Member, 'workspace' | 'status'>[];
  bindings?: Bindings;
  base: string;
  owners: string[];
  ownership?: Array<{ ownerId: string; paths: string[]; eligible?: boolean }>;
  componentId: string;
  assignment: Assignment;
  context: Component[];
  related: Component[];
  role: Role;
  compositionProfile?: CompositionProfile;
  executionProfile: ExecutionProfile;
  activityProfiles?: Record<string, ExecutionProfile>;
  verification: VerificationCheck[];
  artifacts: Array<{ path: string; sha256: string; content: string }>;
  pendingChecks: string[];
  digest: string;
}

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function resolveBase(repository: string, ref = 'HEAD'): { source: string; base: string } {
  try {
    const source = realpathSync(
      git(realpathSync(repository), 'rev-parse', '--show-toplevel').trim(),
    );
    return {
      source,
      base: git(source, 'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`).trim(),
    };
  } catch (error) {
    throw new InputError(String(error));
  }
}

export interface AssignmentOptions {
  additionalVerification?: VerificationCheck[];
  capturedCatalog?: Catalog;
  eligibleOwners?: string[];
  initializerModel?: string;
  value?: unknown;
  bindings?: Bindings;
  objective?: string;
  file?: string;
  kind?: string;
  model?: string;
  timeoutSeconds?: number;
  compositionProfile?: string;
  executionProfile?: string;
}

export function resolveAssignment(
  repository: string,
  base: string,
  id: string,
  options: AssignmentOptions,
): ResolvedAssignment {
  try {
    return new AssignmentResolver(repository, base, id, options).resolve();
  } catch (error) {
    throw new InputError(String(error));
  }
}

const pendingChecks = [
  'Environment prerequisites/setup',
  'Prepared path and symlink validation',
  'Installed Codex sandbox compatibility',
];

/** Captures one assignment’s catalog, permissions, checks and context before preparation. */
class AssignmentResolver {
  private readonly catalog;

  private readonly context;

  private readonly component;

  private readonly env;

  private readonly assignmentSource;

  private readonly assignment;

  /** Resolves the captured catalog and assignment; rejects incompatible input forms before preparation. */
  constructor(
    private readonly repository: string,
    private readonly base: string,
    private readonly id: string,
    private readonly options: AssignmentOptions,
  ) {
    this.catalog =
      options.capturedCatalog ?? loadCatalog(repository, base, options.bindings ?? loadBindings());
    this.context = ancestry(this.catalog, id);
    this.component = this.context.at(-1)!;
    this.env = environment(
      new ConfigurationReader().definition(repository, base, 'architecture/environment').value,
      Object.values(this.catalog.operations),
    );
    if (options.file && (options.objective !== undefined || options.kind !== undefined))
      throw new InputError('--assignment excludes objective and --kind');
    this.assignmentSource = options.file ? new ConfigurationReader().file(options.file) : undefined;
    this.assignment = this.resolveInput();
    this.validateTarget();
    validateOwnerWorkflow(this.assignment, this.component);
  }

  /** Requires an executable owner in the primary writable repository. */
  private validateTarget(): void {
    const { env, component } = this;
    new ComponentOperationPlans(this.catalog).profileCheck(component, true);
    if (env.workspace && component.repository !== env.workspace.primary.id)
      throw new InputError('Assignment component must belong to the writable primary repository');
    if (
      !['gateway', 'library', 'foundation', 'release'].includes(component.type) ||
      !component.verification.length
    )
      throw new InputError('Executable component requires verification');
  }

  /** Validates structured input or constructs the positional-objective assignment. */
  private resolveInput(): Assignment {
    const { options, assignmentSource } = this;
    const assignment = validateSchema<Assignment>(
      'assignment',
      options.value ??
        (assignmentSource
          ? assignmentSource.value
          : {
              schemaVersion: 1,
              objective: options.objective,
              kind: options.kind ?? 'change',
              expectedOutcome: options.objective,
              acceptanceCriteria: [options.objective],
              hostChecks: [],
            }),
    );
    if (!assignment.objective.trim()) throw new InputError('Objective must not be blank');
    return assignment;
  }

  /** Resolves captured inputs and rejects unsupported or inconsistent configuration. */
  resolve(): ResolvedAssignment {
    this.assertReferences();
    const { catalog, assignment, context, component, base, id, env } = this;
    const execution = this.execution();
    const data = {
      configurationSources: this.sources(),
      initialization: captureInitialization(catalog, component, this.options.initializerModel),
      schemaVersion: 1 as const,
      priorEvidence: capturePriorEvidence(assignment),
      operations: execution.operations,
      environment: env,
      workspaceMembers: execution.workspaceMembers,
      ...(execution.bindings ? { bindings: execution.bindings } : {}),
      base,
      ...this.ownerDirectory(),
      componentId: id,
      assignment,
      context,
      related: component.relatedIds.map((id) => catalog.components[id]!),
      role: catalog.roles[component.role]!,
      ...(execution.compositionProfile ? { compositionProfile: execution.compositionProfile } : {}),
      executionProfile: execution.executionProfile,
      activityProfiles: this.activityProfiles(),
      verification: [...component.verification, ...(this.options.additionalVerification ?? [])],
      artifacts: captureCheckArtifacts(assignment),
      pendingChecks: [...pendingChecks],
    };
    return { ...data, digest: digest(JSON.stringify(data)) };
  }

  /** Captures activity settings once; explicit director/verifier profiles do not inherit worker overrides. */
  private activityProfiles(): Record<string, ExecutionProfile> | undefined {
    if (this.options.executionProfile) return undefined;
    const entries = Object.entries(this.component.activityProfiles ?? {});
    if (!entries.length) return undefined;
    return Object.fromEntries(
      entries.map(([activity, id]) => [activity, structuredClone(this.catalog.profiles[id]!)]),
    );
  }

  /** Captures owner identities and repository-relative routing paths without granting write access. */
  private ownerDirectory() {
    const components = this.catalog.components;
    const ownership = OwnershipValidator.repositoryOwners(this.catalog)
      .filter((owner) => !['platform', 'package'].includes(components[owner.component]!.type))
      .map((owner) => ({
        ownerId: owner.component,
        paths: [...owner.paths],
        eligible: this.options.eligibleOwners?.includes(owner.component),
      }));
    return { owners: Object.keys(components), ownership };
  }

  /** Rejects unresolved references before they can enter assignment context. */
  private assertReferences(): void {
    for (const component of this.context)
      for (const contract of component.contractSnapshots ?? [])
        if (!contract.artifact)
          throw new InputError(`Missing repository binding for captured contract: ${contract.id}`);
  }

  /** Collects source snapshots used to reconstruct assignment authority. */
  private sources() {
    const { catalog, options, assignmentSource } = this;
    return [
      ...catalog.configurationSources,
      ...(options.bindings?.configurationSource ? [options.bindings.configurationSource] : []),
      ...(assignmentSource ? [assignmentSource] : []),
    ];
  }

  /** Builds the effective execution settings from captured profile and caller overrides. */
  private execution() {
    const { repository, base, env, options } = this;
    const { compositionProfile, executionProfile } = this.profiles();
    return {
      workspaceMembers: resolveMembers(
        repository,
        base,
        '/workspace',
        env,
        options.bindings ?? loadBindings(),
      ).map(({ workspace, status, ...member }) => member),
      ...(options.bindings ? { bindings: options.bindings } : {}),
      ...(compositionProfile ? { compositionProfile } : {}),
      executionProfile,
      operations: this.operations(executionProfile),
    };
  }

  /** Resolves execution and composition selections without confusing their responsibilities. */
  private profiles() {
    const { catalog, component, context, options } = this;
    const profileId = options.executionProfile ?? component.executionProfile;
    if (!Object.hasOwn(catalog.profiles, profileId))
      throw new InputError(`Unknown execution profile: ${profileId}`);
    const compositionProfile = options.compositionProfile
      ? catalog.compositions[options.compositionProfile]
      : undefined;
    if (
      options.compositionProfile &&
      (!Object.hasOwn(catalog.compositions, options.compositionProfile) ||
        !context.some((c) => c.type === 'package' && compositionProfile!.packageIds.includes(c.id)))
    )
      throw new InputError('Component is outside selected composition profile');
    const executionProfile = { ...catalog.profiles[profileId]! };
    if (options.model) executionProfile.model = options.model;
    if (options.timeoutSeconds !== undefined)
      executionProfile.timeoutSeconds = options.timeoutSeconds;
    return { compositionProfile, executionProfile };
  }

  /** Selects only operations authorized by both component and assignment. */
  private operations(executionProfile: ExecutionProfile): Operation[] {
    const { assignment, component, catalog, env } = this;
    if (component.schemaVersion >= 5) {
      if (assignment.operationIds)
        throw new InputError('Assignments cannot substitute captured operation usages');
      return (component.operationPlan?.agent ?? []).filter((op) =>
        component.operations?.[op.id]?.includes('agent'),
      );
    }
    const requestedOperations = assignment.operationIds ?? component.operationIds ?? [];
    if (requestedOperations.some((id) => !(component.operationIds ?? []).includes(id)))
      throw new InputError('Assignment widens operation authority');
    const operations = requestedOperations.map((id) => catalog.operations[id]!);
    validateOperations(operations, executionProfile, env);
    return operations;
  }
}

function capturePriorEvidence(assignment: Assignment): EvidenceSnapshot[] {
  const priorEvidence: EvidenceSnapshot[] = [],
    historyPaths = new Set<string>();
  let historyBytes = 0;
  for (const ref of assignment.priorEvidence ?? []) {
    if (!isAbsolute(ref.path) || !statSync(ref.path).isFile())
      throw new InputError('Prior evidence must be an absolute regular text file');
    const canonical = realpathSync(ref.path);
    if (historyPaths.has(canonical)) throw new InputError('Duplicate prior evidence');
    historyPaths.add(canonical);
    if (statSync(ref.path).size > 65536 - historyBytes)
      throw new InputError('Prior evidence exceeds 64 KiB');
    const bytes = readFileSync(ref.path);
    historyBytes += bytes.length;
    if (historyBytes > 65536) throw new InputError('Prior evidence exceeds 64 KiB');
    if (!isUtf8(bytes) || bytes.includes(0))
      throw new InputError('Prior evidence must be UTF-8 text');
    priorEvidence.push({
      ...ref,
      sha256: digest(bytes),
      bytes: bytes.length,
      content: bytes.toString('utf8'),
    });
  }
  return priorEvidence;
}

function captureCheckArtifacts(assignment: Assignment): ResolvedAssignment['artifacts'] {
  const artifacts: ResolvedAssignment['artifacts'] = [],
    seen = new Set<string>();
  for (const check of assignment.hostChecks) {
    commands([check]);
    if (!isAbsolute(check.command)) throw new InputError('Host check executable must be absolute');
    if (seen.has(check.id)) throw new InputError('Duplicate host check identity');
    seen.add(check.id);
    for (const p of check.artifacts) {
      if (!isAbsolute(p) || p.includes('/../') || p.includes('/./') || !statSync(p).isFile())
        throw new InputError('Host check artifacts must be absolute regular files');
      if (!artifacts.some((a) => a.path === p)) {
        const data = readFileSync(p);
        artifacts.push({ path: p, sha256: digest(data), content: data.toString('base64') });
      }
    }
  }
  return artifacts;
}

export function materializeChecks(resolved: ResolvedAssignment, directory: string): HostCheck[] {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const replacements = new Map<string, string>();
  resolved.artifacts.forEach((artifact) => {
    const p = join(directory, 'files', artifact.path.slice(1));
    mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
    const bytes = Buffer.from(artifact.content, 'base64');
    if (digest(bytes) !== artifact.sha256) throw new Error('Acceptance snapshot hash mismatch');
    writeFileSync(p, bytes, { mode: 0o500 });
    replacements.set(artifact.path, p);
  });
  return resolved.assignment.hostChecks.map((check) => ({
    ...check,
    command: replacements.get(check.command) ?? check.command,
    args: check.args.map((arg) => replacements.get(arg) ?? arg),
  }));
}

export function materializeEvidence(resolved: ResolvedAssignment, directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [index, item] of (resolved.priorEvidence ?? []).entries()) {
    if (digest(item.content) !== item.sha256)
      throw new Error('Prior evidence snapshot hash mismatch');
    writeFileSync(join(directory, `${index}.txt`), item.content, { mode: 0o400 });
  }
  writeFileSync(
    join(directory, 'manifest.json'),
    JSON.stringify(
      (resolved.priorEvidence ?? []).map(({ content, ...item }) => item),
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
}
