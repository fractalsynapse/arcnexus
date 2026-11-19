import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { getFileInfo } from 'prettier';
import { parse } from 'yaml';
import { team } from '../../team/src/index.js';

export { unifiedDiff, type ContentPatch } from './diff.js';

export interface QualitySelection {
  operation: 'format:check' | 'lint';
  owner?: string;
  files: string[];
  identity: string;
}

export type QualityOperation = QualitySelection['operation'];

export interface QualityRuntime {
  executable: 'prettier' | 'eslint';
  args: string[];
}

const qualityRuntimeDefinitions: Record<QualityOperation, QualityRuntime> = {
  'format:check': {
    executable: 'prettier',
    args: ['--check', '--no-error-on-unmatched-pattern'],
  },
  lint: {
    executable: 'eslint',
    args: ['--max-warnings', '0'],
  },
};

/** Return the existing executable definition used by the owner quality runner. */
export function qualityRuntime(operation: QualityOperation): QualityRuntime {
  return qualityRuntimeDefinitions[operation];
}

/** Discover applicable operation inputs and bind them to ownership and tool configuration. */
const ignoreFileContents = new Map<string, string>();

export async function selectQualityInputs(
  operation: QualitySelection['operation'],
  owner?: string,
): Promise<QualitySelection> {
  ignoreFileContents.clear();
  const componentFiles = globSync('.arc/architecture/components/*.yaml');
  const components: Component[] = componentFiles.map((path) => parse(readFileSync(path, 'utf8')));
  assert(
    owner === undefined || components.some(({ id }) => id === owner),
    `Unknown owner: ${owner}`,
  );
  const files = await selectOwnedQualityFiles(operation, owner, components);
  const identity = qualityIdentity(operation, owner, files, components, componentFiles);
  return { operation, owner, files, identity };
}

interface QualityOperationBinding {
  tool: string;
  applicability: string;
  command: string;
  args: (string | { context: string })[];
}

/** Resolve a binding only when its script and shared runtime implementation are present. */
export function qualityOperationAvailable(binding: QualityOperationBinding): boolean {
  if (binding.tool !== 'check' || binding.command !== 'npm') return false;
  const [run, operation, context, ...extra] = binding.args;
  if (
    run !== 'run' ||
    typeof operation !== 'string' ||
    JSON.stringify(context) !== JSON.stringify({ context: 'owner' }) ||
    extra.length > 0 ||
    !Object.hasOwn(qualityRuntimeDefinitions, operation) ||
    binding.applicability !== `owner-${operation === 'format:check' ? 'format' : operation}-files`
  )
    return false;
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<
    string,
    string
  >;
  const script = scripts[operation];
  const tokens = script?.trim().split(/\\s+/) ?? [];
  return (
    tokens.length === 3 &&
    tokens[0] === 'jiti' &&
    tokens[1] === 'packages/foundation/scripts/owner-quality.ts' &&
    tokens[2] === operation &&
    existsSync(tokens[1])
  );
}

/** Resolve applicable maintained paths through tool configuration and Team ownership. */
async function selectOwnedQualityFiles(
  operation: QualitySelection['operation'],
  owner: string | undefined,
  components: readonly Component[],
): Promise<string[]> {
  const candidates = discoverMaintainedFiles()
    .filter((path) => operation !== 'format:check' || isFormatCovered(path))
    .sort();
  const eslint = operation === 'lint' ? new ESLint() : undefined;
  const files: string[] = [];
  for (const path of candidates) {
    if (eslint && (await eslint.isPathIgnored(path))) continue;
    if (
      operation === 'format:check' &&
      (await getFileInfo(path, { ignorePath: '.prettierignore' })).ignored
    )
      continue;
    const resolution = team.ownerFor(components, path);
    assert.notEqual(resolution.kind, 'collision', `Ambiguous ownership: ${path}`);
    assert.equal(resolution.kind, 'owned', `Unowned maintained input: ${path}`);
    if (!owner || resolution.owner.id === owner) files.push(path);
  }
  return files;
}

/** Hash selected ownership and every configuration input that affects scope. */
function selectionIdentity(
  operation: QualitySelection['operation'],
  owner: string | undefined,
  files: readonly string[],
  components: readonly Component[],
): string {
  return JSON.stringify({
    operation,
    owner,
    files,
    owners: files.map((path) => [path, team.ownerFor(components, path)]),
  });
}

/** Hash selected ownership and every configuration input that affects scope. */
function qualityIdentity(
  operation: QualitySelection['operation'],
  owner: string | undefined,
  files: readonly string[],
  components: readonly Component[],
  componentFiles: readonly string[],
): string {
  const identity = createHash('sha256');
  identity.update(selectionIdentity(operation, owner, files, components));
  for (const path of identityInputPaths(operation, files, componentFiles)) {
    if (existsSync(path))
      identity
        .update(path)
        .update('\\u0000present\\u0000')
        .update(path.endsWith('.gitignore') ? readIgnoreFile(path) : readFileSync(path));
    else identity.update(path).update('\\u0000missing\\u0000');
  }
  return identity.digest('hex');
}

/** Collect selected source, owner, tool and ignore inputs for a stable operation identity. */
function identityInputPaths(
  operation: QualitySelection['operation'],
  files: readonly string[],
  componentFiles: readonly string[],
): string[] {
  return [
    ...new Set([
      ...files,
      ...componentFiles,
      'package.json',
      'package-lock.json',
      'packages/foundation/src/index.ts',
      'packages/foundation/scripts/owner-quality.ts',
      '.eslintignore',
      '.prettierignore',
      ...relevantGitignoreFiles(files),
      ...editorConfigurationInputs(files),
      ...prettierConfigurationInputs(operation, files),
      ...configurationInputs(operation),
    ]),
  ].sort();
}

/** Find editor settings that can affect selected files. */
function editorConfigurationInputs(files: readonly string[]): string[] {
  const directories = new Set(['.']);
  for (const file of files) {
    for (const directory of parentDirectories(file)) directories.add(directory);
  }
  return [...directories]
    .map((directory) => (directory === '.' ? '.editorconfig' : `${directory}/.editorconfig`))
    .filter((path) => existsSync(path))
    .sort();
}

/** Find ignore files that can affect the selected paths. */
function relevantGitignoreFiles(files: readonly string[]): string[] {
  const directories = new Set<string>(['.']);
  for (const file of files) {
    for (const directory of parentDirectories(file)) directories.add(directory);
  }
  return [...directories]
    .map((directory) => (directory === '.' ? '.gitignore' : `${directory}/.gitignore`))
    .filter((path) => existsSync(path))
    .sort();
}

/** Resolve Prettier configuration files along selected paths without hashing unrelated configs. */
function prettierConfigurationInputs(
  operation: QualitySelection['operation'],
  files: readonly string[],
): string[] {
  if (operation !== 'format:check') return [];
  const paths = new Set<string>();
  collectPrettierConfigurationPaths(paths, files);
  return [...paths].sort();
}

/** Collect existing conventional formatter configs along selected file paths. */
function collectPrettierConfigurationPaths(paths: Set<string>, files: readonly string[]): void {
  const names = [
    '.prettierrc',
    '.prettierrc.yaml',
    '.prettierrc.yml',
    '.prettierrc.json',
    '.prettierrc.json5',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.ts',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
  ];
  for (const file of files) {
    for (const base of ['.', ...parentDirectories(file)]) {
      for (const name of names) {
        const path = base === '.' ? name : `${base}/${name}`;
        if (readOptionalFile(path) !== '') paths.add(path);
      }
    }
  }
}

/** Return each containing directory from nearest to repository root. */
function parentDirectories(file: string): string[] {
  const directories: string[] = [];
  let directory = dirname(file);
  while (directory !== '.') {
    directories.push(directory);
    directory = dirname(directory);
  }
  return directories;
}

/** Follow local imports from quality configuration without hashing unrelated source. */
function configurationInputs(operation: QualitySelection['operation']): string[] {
  const pending = operation === 'lint' ? ['eslint.config.ts'] : [];
  const visited = new Set<string>();
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readOptionalFile(path);
    for (const match of source.matchAll(/(?:from\\s*|import\\s*)['"](\\.[^'"]+)['"]/g)) {
      const specifier = match[1]!;
      const resolved = resolve(dirname(path), specifier);
      const base = resolved.replace(/\\.(?:[cm]?js|tsx?)$/, '');
      const candidates = [`${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}.mts`, resolved];
      const dependency = candidates.find((candidate) => readOptionalFile(candidate) !== '');
      if (dependency) pending.push(dependency);
    }
  }
  return [...visited].sort();
}

/** Identify exact UTF-8 content used in reviewed proposals and recorded source observations. */
export function textDigest(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

/** Extract authored acceptance identities for registry amendment and offline validation. */
export function acceptanceScenarios(content: string) {
  return [...content.matchAll(/^\\| ([A-Z]+-\\d+[a-z]?) \\|/gm)].map((match) => match[1]!);
}

interface Component {
  id: string;
  owns: string[];
}

interface Suite {
  file: string;
  owner: string;
  level: string;
}

const suitePattern = '{apps,packages}/*/tests/**/*.test';

/** Derive suite registration from the source owner and level directory. */
export function registerSuite(file: string, components: readonly Component[]): Suite {
  const source = file.replace(/^dist\\//, '').replace(/\\.js$/, '.ts');
  const owners = team.owners(components, source);
  const [owner] = owners;
  assert(owners.length === 1 && owner, `Expected one test owner for ${source}`);
  const level = source.match(/\\/tests\\/([^/]+)\\//)?.[1];
  assert(
    level && ['unit', 'integration', 'acceptance'].includes(level),
    `Invalid test level for ${source}; use tests/unit, tests/integration or tests/acceptance`,
  );
  return { file, owner: owner.id, level };
}

/** Validate all built suite registrations before selecting the requested owner. */
export function testInventory(owner?: string): Suite[] {
  const components: Component[] = globSync('.arc/architecture/components/*.yaml').map((path) =>
    parse(readFileSync(path, 'utf8')),
  );
  assert(!owner || components.some(({ id }) => id === owner), `Unknown test owner: ${owner}`);
  const selected = discoverSuites('.', `dist/${suitePattern}.js`, components).filter(
    (suite) => !owner || suite.owner === owner,
  );
  assert(selected.length > 0, `No built test suites for ${owner ?? 'this repository'}`);
  return selected;
}

/** Resolve suites from the current source tree using the captured component owners. */
export function hasOwnerTestSuites(
  directory: string,
  owner: string,
  components: readonly Component[],
): boolean {
  assert(
    components.some(({ id }) => id === owner),
    `Unknown test owner: ${owner}`,
  );
  return discoverSuites(directory, `${suitePattern}.ts`, components).some(
    (suite) => suite.owner === owner,
  );
}

/** Use the same registration rules for source discovery and built test selection. */
function discoverSuites(directory: string, pattern: string, components: readonly Component[]) {
  return globSync(pattern, { cwd: directory })
    .sort()
    .map((file) => registerSuite(file, components));
}

/** Read an optional root input when an isolated consumer does not provide one. */
function readOptionalFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

/** Read each reachable ignore file once for discovery and its matching identity. */
function readIgnoreFile(path: string): string {
  const cached = ignoreFileContents.get(path);
  if (cached !== undefined) return cached;
  const content = readFileSync(path, 'utf8');
  ignoreFileContents.set(path, content);
  return content;
}

interface IgnoreMatcher {
  add(patterns: string): IgnoreMatcher;
  test(path: string): { ignored: boolean; unignored: boolean };
}

interface IgnoreOptions {
  ignorecase: false;
}

interface IgnoreScope {
  directory: string;
  matcher: IgnoreMatcher;
}

const createIgnore = createRequire(import.meta.url)('ignore') as (
  options: IgnoreOptions,
) => IgnoreMatcher;

/** Walk maintained paths once, loading reachable ignore rules as each directory is entered. */
function discoverMaintainedFiles(): string[] {
  const files: string[] = [];
  const ignoredRoots = new Set(['.git', 'node_modules', 'dist', '.test-build']);
  const visit = (directory: string, inherited: readonly IgnoreScope[]): void => {
    const ignorePath = directory === '.' ? '.gitignore' : `${directory}/.gitignore`;
    const scopes = [...inherited];
    if (existsSync(ignorePath)) {
      const matcher = createIgnore({ ignorecase: false });
      matcher.add(readIgnoreFile(ignorePath));
      scopes.push({ directory, matcher });
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = directory === '.' ? entry.name : `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (ignoredRoots.has(path) || isIgnoredByScopes(path, scopes, true)) continue;
        visit(path, scopes);
      } else if (entry.isFile() && !isIgnoredByScopes(path, scopes, false)) {
        files.push(path);
      }
    }
  };
  visit('.', []);
  return files;
}

/** Apply each reachable ignore file in parent-first order, retaining later negations. */
function isIgnoredByScopes(
  path: string,
  scopes: readonly IgnoreScope[],
  directory: boolean,
): boolean {
  let ignored = false;
  for (const { directory: base, matcher } of scopes) {
    const relative = base === '.' ? path : path.slice(base.length + 1);
    const result = matcher.test(directory ? `${relative}/` : relative);
    if (result.ignored) ignored = true;
    if (result.unignored) ignored = false;
  }
  return ignored;
}

/** Preserve repository formatter coverage while allowing package and fixture files. */
function isFormatCovered(path: string): boolean {
  return /^(?:[^/]+\\.(?:ts|json)|(?:apps|packages|scripts|fixtures)\\/.+\\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx|json|yaml|yml))$/.test(
    path,
  );
}
