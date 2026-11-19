import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
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

/** Discover applicable operation inputs and bind them to ownership and tool configuration. */
export async function selectQualityInputs(
  operation: QualitySelection['operation'],
  owner?: string,
): Promise<QualitySelection> {
  const componentFiles = globSync('.arc/architecture/components/*.yaml');
  const components: Component[] = componentFiles.map((path) => parse(readFileSync(path, 'utf8')));
  assert(owner === undefined || components.some(({ id }) => id === owner), `Unknown owner: ${owner}`);
  const files = await selectOwnedQualityFiles(operation, owner, components);
  const identity = qualityIdentity(operation, owner, files, components, componentFiles);
  return { operation, owner, files, identity };
}

/** Resolve applicable maintained paths through tool configuration and Team ownership. */
async function selectOwnedQualityFiles(
  operation: QualitySelection['operation'],
  owner: string | undefined,
  components: readonly Component[],
): Promise<string[]> {
  const candidates = globSync(operation === 'lint' ? '**/*' : '**/*.{ts,mts,cts,js,mjs,cjs,jsx,tsx,json,yaml,yml}')
    .filter((path) => !isIgnored(path))
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
  for (const path of [
    ...componentFiles,
    ...configurationInputs(operation),
    ...files,
    ...globSync('**/.gitignore'),
    '.eslintignore',
    '.prettierignore',
    '.prettierrc.yaml',
    'eslint.config.ts',
    'package.json',
    'package-lock.json',
  ]) {
    identity.update(path).update(readOptionalFile(path) || 'missing');
  }
  return identity.digest('hex');
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
    for (const match of source.matchAll(/(?:from\s*|import\s*)['\"](\.[^'\"]+)['\"]/g)) {
      const specifier = match[1]!;
      const base = specifier.replace(/\.(?:[cm]?js|tsx?)$/, '');
      const candidates = [`${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}.mts`, base];
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
  return [...content.matchAll(/^\| ([A-Z]+-\d+[a-z]?) \|/gm)].map((match) => match[1]!);
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
  const source = file.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  const owners = team.owners(components, source);
  const [owner] = owners;
  assert(owners.length === 1 && owner, `Expected one test owner for ${source}`);
  const level = source.match(/\/tests\/([^/]+)\//)?.[1];
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
  } catch {
    return '';
  }
}

/** Apply root and nested gitignore rules in directory order to one repository path. */
function isIgnored(path: string): boolean {
  let ignored = false;
  const ignoreFiles = globSync('**/.gitignore').sort(
    (left, right) => left.split('/').length - right.split('/').length,
  );
  for (const [index, ignoreFile] of ignoreFiles.entries()) {
    const directory = ignoreFile.slice(0, -'.gitignore'.length).replace(/\/$/, '');
    if (directory && !path.startsWith(`${directory}/`)) continue;
    const relative = directory ? path.slice(directory.length + 1) : path;
    const rules = readOptionalFile(ignoreFile).split(String.fromCharCode(10));
    if (directory && isIgnoredDirectory(directory, ignoreFiles.slice(0, index))) continue;
    const segments = relative.split('/');
    let inherited = false;
    for (let segment = 0; segment < segments.length; segment++) {
      const candidate = segments.slice(0, segment + 1).join('/');
      const result = matchesIgnoreRules(candidate, rules, segment < segments.length - 1);
      if (result !== undefined) inherited = result;
      if (inherited && segment < segments.length - 1) break;
    }
    if (inherited) ignored = true;
    else if (matchesIgnoreRules(relative, rules) === false) ignored = false;
  }
  return ignored;
}

/** Check whether earlier ignore files exclude a directory before reading its rules. */
function isIgnoredDirectory(directory: string, ignoreFiles: readonly string[]): boolean {
  let ignored = false;
  for (const ignoreFile of ignoreFiles) {
    const base = ignoreFile.slice(0, -'.gitignore'.length).replace(/\/$/, '');
    if (base && !directory.startsWith(`${base}/`)) continue;
    if (base && base !== directory && isIgnoredDirectory(base, ignoreFiles)) continue;
    const relative = base ? directory.slice(base.length + 1) : directory;
    const rules = readOptionalFile(ignoreFile).split(String.fromCharCode(10));
    let inherited = false;
    const segments = relative.split('/');
    for (let segment = 0; segment < segments.length; segment++) {
      const candidate = segments.slice(0, segment + 1).join('/');
      const result = matchesIgnoreRules(candidate, rules, true);
      if (result !== undefined) inherited = result;
      if (inherited && segment < segments.length - 1) break;
    }
    if (inherited) ignored = true;
    else if (matchesIgnoreRules(relative, rules, true) === false) ignored = false;
  }
  return ignored;
}

/** Match ordered gitignore rules against paths relative to one ignore file. */
function matchesIgnoreRules(
  path: string,
  rules: readonly string[],
  isDirectory = false,
): boolean | undefined {
  let ignored: boolean | undefined;
  for (const raw of rules) {
    const rule = raw;
    if (!rule || (rule.startsWith('#') && !rule.startsWith('\\#'))) continue;
    const negated = rule.startsWith('!');
    const source = (negated ? rule.slice(1) : rule).replace(/^\\([#! ])/g, '$1');
    const anchored = source.startsWith('/');
    const directoryOnly = source.endsWith('/');
    const pattern = source.replace(/^\//, '').replace(/\/$/, '');
    const matcher = ignoreMatcher(pattern, anchored, directoryOnly, isDirectory);
    const matches = matcher.test(path);
    if (matches) ignored = !negated;
  }
  return ignored;
}

/** Convert gitignore wildcards into path-aware matching. */
function ignoreMatcher(
  pattern: string,
  anchored: boolean,
  directoryOnly = false,
  isDirectory = false,
): RegExp {
  const escaped = pattern.replace(/[|\\{}()^$+.]/g, '\\$&');
  const slashless = !anchored && !pattern.includes('/');
  const expression = escaped
    .replace(/\[!([^\]]+)\]/g, '[^$1]')
    .replace(/\[([^\]]+)\]/g, '[$1]')
    .replace(/\*\*\//g, '§/')
    .replace(/\*\*/g, '§')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/§\//g, '(?:.*/)?')
    .replace(/§/g, '.*');
  const prefix = slashless ? '(?:.*/)?' : '';
  const descendants = directoryOnly ? (isDirectory ? '(?:/.*)?' : '/.+') : '(?:/.*)?';
  return new RegExp(`^${prefix}(?:${expression})${descendants}$`);
}
/** Preserve repository formatter coverage while allowing package and fixture files. */
function isFormatCovered(path: string): boolean {
  return /^(?:[^/]+\.(?:ts|json)|(?:apps|packages|scripts|fixtures)\/.+\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx|json|yaml|yml))$/.test(
    path,
  );
}
