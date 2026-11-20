import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { matchesTestFilter, SuiteMetadataReader, type TestFilter } from './test-selection.js';
import { team } from '../../team/src/index.js';

export { unifiedDiff, type ContentPatch } from './diff.js';
export { TestSelection, type TestFilter } from './test-selection.js';
export { Quality, qualityScopePrefix, type QualityScope } from './quality.js';

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
  tags: string[];
}

const suitePattern = '{apps,packages}/*/tests/**/*.test';

/** Derive suite registration from the source owner and level directory. */
export function registerSuite(
  file: string,
  components: readonly Component[],
  text?: string,
): Suite {
  const source = file.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  const owners = team.owners(components, source);
  const [owner] = owners;
  assert(owner, `Missing test owner for ${source}`);
  assert(
    owners.length === 1,
    `Test ownership collision for ${source}: ${owners.map(({ id }) => id).join(', ')}`,
  );
  const level = source.match(/\/tests\/([^/]+)\//)?.[1];
  assert(
    level && ['unit', 'integration', 'acceptance'].includes(level),
    `Invalid test level for ${source}; use tests/unit, tests/integration or tests/acceptance`,
  );
  const metadata = text === undefined ? undefined : new SuiteMetadataReader(file).read(text);
  if (metadata) {
    assert.equal(metadata.owner, owner.id, `Suite owner contradicts path: ${source}`);
    assert.equal(metadata.level, level, `Suite level contradicts path: ${source}`);
  }
  return { file, owner: owner.id, level, tags: metadata?.tags ?? [] };
}

/** Validate all built suite registrations before selecting the requested owner. */
export function testInventory(owner?: string, filter: TestFilter = {}): Suite[] {
  const components: Component[] = globSync('.arc/architecture/components/*.yaml').map((path) =>
    parse(readFileSync(path, 'utf8')),
  );
  assert(!owner || components.some(({ id }) => id === owner), `Unknown test owner: ${owner}`);
  const selected = discoverSuites('.', `dist/${suitePattern}.js`, components).filter(
    (suite) => (!owner || suite.owner === owner) && matchesTestFilter(suite, filter),
  );
  assert(
    selected.length > 0,
    `No built test suites for ${owner ?? 'this repository'}; selection: ${JSON.stringify(filter)}`,
  );
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
    .map((file) => registerSuite(file, components, readFileSync(`${directory}/${file}`, 'utf8')));
}
