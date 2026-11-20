import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { stringify } from 'yaml';
import { hasOwnerTestSuites, registerSuite, testInventory } from '../../src/index.js';

export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const;

const components = [
  { id: 'terminal-owner', owns: ['apps/shell'] },
  { id: 'engine-owner', owns: ['packages/engine'] },
  { id: 'guides-owner', owns: ['docs'] },
];
const terminal = 'apps/shell/tests/unit/terminal.test.ts';
const engine = 'packages/engine/tests/integration/engine.test.ts';

const expectedInventory = [
  {
    file: 'dist/apps/shell/tests/unit/terminal.test.js',
    owner: 'terminal-owner',
    level: 'unit',
    tags: ['fixture'],
  },
  {
    file: 'dist/packages/engine/tests/integration/engine.test.js',
    owner: 'engine-owner',
    level: 'integration',
    tags: ['fixture'],
  },
];

/** Supply corresponding source and emitted trees with explicit, directory-independent ownership. */
class InventoryScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-inventory-'));
  readonly marker = join(this.root, 'import-effect');

  /** Retain cleanup even on assertion failure and make emitted fixture modules executable as ESM. */
  constructor(context: TestContext) {
    context.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.write('package.json', '{"type":"module"}');
    this.catalog(components);
    this.pair(terminal, this.metadata('terminal-owner', 'unit'));
    this.pair(engine, this.metadata('engine-owner', 'integration'));
  }

  /** Replace the fixture catalog without borrowing the live checkout's ownership. */
  catalog(owners: typeof components) {
    for (const owner of owners)
      this.write(`.arc/architecture/components/${owner.id}.yaml`, stringify(owner));
  }

  /** Include a real observable effect that discovery must leave dormant. */
  metadata(owner: string, level: string) {
    return `import { writeFileSync } from 'node:fs';
export const suite = { owner: '${owner}', level: '${level}', tags: ['fixture'] };
writeFileSync(${JSON.stringify(this.marker)}, 'suite executed');
`;
  }

  /** Author equivalent literal metadata in source and emitted files, preserving their path mapping. */
  pair(source: string, text: string) {
    this.write(source, text);
    this.write(this.built(source), text);
  }

  /** Resolve the expected emitted identity independently of the product registration result. */
  built(source: string) {
    return 'dist/' + source.replace(/\.ts$/, '.js');
  }

  /** Write isolated authored fixture inputs without changing the checkout or generated inventory. */
  write(path: string, text: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), text);
  }

  /** Invoke the actual built public API in a process whose working tree is the explicit fixture. */
  inventory(owner?: string) {
    const entry = new URL('../../src/index.js', import.meta.url).href;
    const script = `import { testInventory } from ${JSON.stringify(entry)};
console.log(JSON.stringify(testInventory(${JSON.stringify(owner)})));
`;
    return spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: this.root,
      encoding: 'utf8',
    });
  }

  /** Confirm rejected inventories name the bad source even when a different valid owner is requested. */
  refuses(source: string, diagnostic: RegExp) {
    assert.throws(() => hasOwnerTestSuites(this.root, 'terminal-owner', components), diagnostic);
    const result = this.inventory('terminal-owner');
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, diagnostic);
    assert(
      result.stderr.includes(source) || result.stderr.includes(this.built(source)),
      result.stderr,
    );
    assert.equal(existsSync(this.marker), false);
  }
}

test('every current built owner selects exactly its inventory subset with unchanged emitted paths', () => {
  const all = testInventory();
  assert.deepEqual(
    all.map(({ file }) => file),
    globSync('dist/{apps,packages}/*/tests/**/*.test.js').sort(),
  );
  assert(all.some(({ owner }) => owner === 'cli-app'));
  assert(all.some(({ owner }) => owner === 'foundation'));
  for (const owner of new Set(all.map((entry) => entry.owner))) {
    const expected = all.filter((entry) => entry.owner === owner);
    assert.deepEqual(testInventory(owner), expected);
    assert(expected.every(({ file }) => file.startsWith('dist/') && file.endsWith('.test.js')));
  }
  assert.throws(() => testInventory('missing'), /Unknown test owner/);
  assert.throws(
    () => testInventory('foundation', { tags: ['absent-inventory-tag'] }),
    /No built test suites/,
  );
});

test('source applicability and built selection agree for explicit catalog owners and an owner without suites', (context) => {
  const scenario = new InventoryScenario(context);
  const result = scenario.inventory();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const all = JSON.parse(result.stdout) as ReturnType<typeof testInventory>;
  assert.deepEqual(all, expectedInventory);
  for (const { id } of components) {
    const expected = all.filter(({ owner }) => owner === id);
    assert.equal(hasOwnerTestSuites(scenario.root, id, components), expected.length > 0);
    const selected = scenario.inventory(id);
    if (expected.length) {
      assert.equal(selected.status, 0, selected.stderr);
      assert.deepEqual(JSON.parse(selected.stdout), expected);
    } else {
      assert.notEqual(selected.status, 0);
      assert.match(selected.stderr, /No built test suites/);
    }
  }
  assert.throws(
    () => hasOwnerTestSuites(scenario.root, 'missing', components),
    /Unknown test owner/,
  );
  assert.equal(existsSync(scenario.marker), false);
});

test('discovery leaves an executable suite import effect dormant until actual execution', (context) => {
  const scenario = new InventoryScenario(context);
  assert.equal(scenario.inventory('terminal-owner').status, 0);
  assert.equal(existsSync(scenario.marker), false);
  const result = spawnSync(process.execPath, [join(scenario.root, scenario.built(terminal))], {
    cwd: scenario.root,
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(scenario.marker), true);
});

test('missing ownership has a distinct diagnostic with the source identity', () => {
  const source = 'apps/orphan/tests/unit/probe.test.ts';
  assert.throws(
    () => registerSuite('dist/' + source.replace(/\.ts$/, '.js'), components),
    (error: Error) =>
      /missing|unowned|no .*owner/i.test(error.message) && error.message.includes(source),
  );
});

test('ownership collisions identify the source and every conflicting component', () => {
  const source = 'apps/shell/tests/unit/probe.test.ts';
  const owners = [
    ...components,
    { id: 'umbrella-owner', owns: ['apps'] },
    { id: 'overlap-owner', owns: ['apps/shell/tests'] },
  ];
  assert.throws(
    () => registerSuite('dist/' + source.replace(/\.ts$/, '.js'), owners),
    (error: Error) =>
      /collision|conflict|multiple.*owner/i.test(error.message) &&
      [source, 'terminal-owner', 'umbrella-owner', 'overlap-owner'].every((text) =>
        error.message.includes(text),
      ),
  );
});

test('an unowned foreign suite cannot disappear behind an owner filter', (context) => {
  const scenario = new InventoryScenario(context);
  const orphan = 'packages/orphan/tests/unit/orphan.test.ts';
  scenario.pair(orphan, scenario.metadata('orphan', 'unit'));
  scenario.refuses(orphan, /missing|unowned|no .*owner/i);
});

test('a foreign ownership collision reports every catalog claimant before selection', (context) => {
  const scenario = new InventoryScenario(context);
  scenario.catalog([{ id: 'overlap-owner', owns: ['packages/engine'] }]);
  const result = scenario.inventory('terminal-owner');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /collision|conflict|multiple.*owner/i);
  for (const text of [engine, 'engine-owner', 'overlap-owner'])
    assert(result.stderr.includes(text), result.stderr);
  const owners = [...components, { id: 'overlap-owner', owns: ['packages/engine'] }];
  assert.throws(
    () => hasOwnerTestSuites(scenario.root, 'terminal-owner', owners),
    /collision|conflict|multiple.*owner/i,
  );
  assert.equal(existsSync(scenario.marker), false);
});

const invalidMetadata = [
  {
    name: 'contradictory owner',
    before: "owner: 'engine-owner'",
    after: "owner: 'terminal-owner'",
    diagnostic: /owner contradicts path/i,
  },
  {
    name: 'contradictory level',
    before: "level: 'integration'",
    after: "level: 'unit'",
    diagnostic: /level contradicts path/i,
  },
  {
    name: 'computed owner',
    before: "owner: 'engine-owner'",
    after: "owner: String('engine-owner')",
    diagnostic: /literal suite owner/i,
  },
  {
    name: 'computed tags',
    before: "tags: ['fixture']",
    after: "tags: Array.of('fixture')",
    diagnostic: /literal suite tags/i,
  },
  {
    name: 'nonliteral tag',
    before: "tags: ['fixture']",
    after: "tags: [String('fixture')]",
    diagnostic: /literal suite tag/i,
  },
  {
    name: 'duplicate field',
    before: "owner: 'engine-owner'",
    after: "owner: 'engine-owner', owner: 'engine-owner'",
    diagnostic: /duplicate suite metadata owner/i,
  },
  {
    name: 'spread metadata',
    before: "tags: ['fixture']",
    after: "...{ tags: ['fixture'] }",
    diagnostic: /literal suite metadata/i,
  },
];

for (const invalid of invalidMetadata) {
  test(`foreign ${invalid.name} is refused in source and built discovery before import`, (context) => {
    const scenario = new InventoryScenario(context);
    scenario.pair(
      engine,
      scenario.metadata('engine-owner', 'integration').replace(invalid.before, invalid.after),
    );
    scenario.refuses(engine, invalid.diagnostic);
  });
}

test('invalid foreign level placement is refused before owner selection or execution', (context) => {
  const scenario = new InventoryScenario(context);
  const source = 'packages/engine/tests/fast/invalid.test.ts';
  scenario.pair(source, scenario.metadata('engine-owner', 'unit'));
  scenario.refuses(source, /Invalid test level/);
});
