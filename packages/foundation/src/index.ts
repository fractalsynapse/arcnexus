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
  assert(!owner || components.some(({ id }) => id === owner), `Unknown owner: ${owner}`);
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
  const ignored = readOptionalFile('.gitignore').split(/\r?\n/);
  const candidates = globSync('**/*.{ts,mts,cts,js,mjs,cjs,jsx,tsx,json,yaml,yml}')
    .filter((path) => !isIgnored(path, ignored))
    .filter((path) => operation !== 'format:check' || isFormatCovered(path))
    .filter((path) => operation !== 'lint' || /\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx)$/.test(path))
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
function qualityIdentity(
  operation: QualitySelection['operation'],
  owner: string | undefined,
  files: readonly string[],
  components: readonly Component[],
  componentFiles: readonly string[],
): string {
  const identity = createHash('sha256');
  identity.update(
    JSON.stringify({
      operation,
      owner,
      files,
      owners: files.map((path) => [path, team.ownerFor(components, path)]),
    }),
  );
  for (const path of [
    ...componentFiles,
    '.gitignore',
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

/** Apply current root gitignore patterns to the repository-relative input. */
function isIgnored(path: string, patterns: readonly string[]): boolean {
  let ignored = false;
  for (const raw of patterns) {
    const rule = raw.trim();
    if (!rule || rule.startsWith('#')) continue;
    const negated = rule.startsWith('!');
    let pattern = negated ? rule.slice(1) : rule;
    if (pattern.startsWith('/')) pattern = pattern.slice(1);
    if (pattern.endsWith('/')) pattern = pattern.slice(0, -1);
    const expression = [...pattern]
      .map((character) => {
        if (character === '*') return '[^/]*';
        if (character === '?') return '[^/]';
        return '.^$+{}()|[]\\'.includes(character) ? '\\' + character : character;
      })
      .join('');
    const matcher = new RegExp(`^(?:${expression})(?:/.*)?$`);
    if (matcher.test(path)) ignored = !negated;
  }
  return ignored;
}

/** Preserve repository formatter coverage while allowing package and fixture files. */
function isFormatCovered(path: string): boolean {
  return /^(?:[^/]+\.(?:ts|json)|(?:apps|packages|scripts|fixtures)\/.+\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx|json))$/.test(
    path,
  );
}
