import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface Component {
  id: string;
  owns: string[];
}

interface Suite {
  file: string;
  owner: string;
  level: string;
}

/** Derive suite registration from the source owner and level directory. */
export function registerSuite(file: string, components: readonly Component[]): Suite {
  const source = file.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  const owners = components.filter(({ owns }) =>
    owns.some((root) => source === root || source.startsWith(root + '/')),
  );
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
  const files = globSync('dist/{apps,packages}/*/tests/**/*.test.js').sort();
  const selected = files
    .map((file) => registerSuite(file, components))
    .filter((suite) => !owner || suite.owner === owner);
  assert(selected.length > 0, `No built test suites for ${owner ?? 'this repository'}`);
  return selected;
}
