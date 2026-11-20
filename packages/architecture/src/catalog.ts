import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { openProject, type ProjectSource } from './source.js';

export const catalogRoot = '.arc/architecture';

/** Locate a definition by its catalog family and declared identity. */
export function definitionPath(family: string, id: string) {
  return `${catalogRoot}/${family}/${id}.yaml`;
}

interface Binding {
  component: string;
  activity: string;
}

export interface Project {
  knowledgeRoot?: string;
  id: string;
  remote: string;
  contractRegistry: string;
  planTemplate: string;
  bindings?: string;
  delivery?: { baseBranch: string; protectedBranch: string; requiredGates: string[] };
  checks?: { acceptance: string[] };
  director: Binding;
  verifier: Binding;
  architect?: Binding;
}

export interface Activity {
  role: string;
  profile?: string;
  executor?: 'host';
  instructions: string[];
  operations: string[];
  standards: string[];
}

interface Definition {
  id: string;
}

export interface Component extends Definition {
  purpose: string;
  summary?: string;
  constraints?: unknown[];
  owns: string[];
  activities: Record<string, Activity>;
}

interface Role extends Definition {
  purpose?: string;
  responsibilities?: string[];
  instructions?: string[];
}

interface Profile extends Definition {
  model: string;
  reasoning: string;
  webSearch: string;
  operationCategories: string[];
}

interface Operation extends Definition {
  category: string;
  tool?: string;
  command?: string;
  args?: Array<string | { context: 'owner' }>;
  cwd?: string;
  network?: boolean;
  applicability?: 'owner-test-suites';
}

interface Standard extends Definition {
  document: string;
}

interface Contract {
  id: string;
  owner: string;
  file: string;
  stage: string;
  digest: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface Capture {
  readonly source: ProjectSource;
  readonly project: Readonly<Project>;
  readonly components: Readonly<Record<string, Component>>;
  readonly roles: Readonly<Record<string, Role>>;
  readonly profiles: Readonly<Record<string, Profile>>;
  readonly operations: Readonly<Record<string, Operation>>;
  readonly standards: Readonly<Record<string, Standard>>;
  readonly contracts: readonly Contract[];
}

/** Read project authority and verify accepted contract bytes at the same revision. */
export function captureProject(directory: string, revision?: string): Capture {
  const source = openProject(directory, revision);
  const project = read<Project>(source, `${catalogRoot}/project.yaml`);
  if (!project.id || !sameRemote(project.remote, source.remote)) {
    throw new Error('Git origin does not match the captured project remote');
  }
  const contracts = read<{ contracts: Contract[] }>(source, project.contractRegistry).contracts;
  verifyLocks(source, contracts);
  return Object.freeze({
    source,
    project,
    contracts: freeze(contracts),
    components: load<Component>(source, 'components'),
    roles: load<Role>(source, 'roles'),
    profiles: load<Profile>(source, 'execution-profiles'),
    operations: load<Operation>(source, 'operations'),
    standards: load<Standard>(source, 'standards'),
  });
}

/** Verify the declared HTTPS identity without allowing credentials in the request. */
function sameRemote(declared: string, actual: string) {
  if (declared !== actual) return false;
  try {
    const remote = new URL(declared);
    return (
      remote.protocol === 'https:' &&
      !remote.username &&
      !remote.password &&
      !remote.search &&
      !remote.hash
    );
  } catch {
    return false;
  }
}

/** Validate component-owned definitions in filename order. */
function load<T extends Definition>(source: ProjectSource, family: string) {
  const prefix = `${catalogRoot}/${family}/`;
  const paths = source.paths
    .filter((path) => path.startsWith(prefix) && path.endsWith('.yaml'))
    .sort();
  return Object.freeze(
    Object.fromEntries(
      paths.map((path) => {
        const definition = read<T>(source, path);
        if (path !== definitionPath(family, definition.id))
          throw new Error(`Catalog identity mismatch: ${path}`);
        return [definition.id, definition];
      }),
    ),
  );
}

/** Keep captured definitions immutable across resolution and request assembly. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) freeze(entry);
  }
  return value;
}

/** Read an authored mapping from the fixed source, with the path in diagnostics. */
function read<T>(source: ProjectSource, path: string): T {
  const definition: unknown = parse(source.read(path));
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new Error(`Expected a catalog mapping: ${path}`);
  }
  return freeze(definition) as T;
}

/** Refuse a changed locked file or a lock without admission evidence. */
function verifyLocks(source: ProjectSource, contracts: readonly Contract[]) {
  for (const entry of contracts) {
    if (entry.stage !== 'locked') continue;
    const hash = createHash('sha256').update(source.read(entry.file)).digest('hex');
    if (!entry.acceptedBy || !entry.acceptedAt || hash !== entry.digest) {
      throw new Error(`Invalid locked contract: ${entry.id} (${entry.file})`);
    }
  }
}
