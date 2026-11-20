import assert from 'node:assert/strict';
import test from 'node:test';
import * as foundation from '../../src/index.js';

export const suite = {
  owner: 'foundation',
  level: 'unit',
  tags: ['regression', 'selection'],
} as const;

/** Exercise the public selector API without importing or executing selected suites. */
class SelectionScenario {
  /** Parse the same argv used by a person or a parameterized activity operation. */
  parse(args: string[]) {
    return new foundation.TestSelection(args);
  }
}

test('test selection combines owner with repeated tag and level filters and explicit native execution', () => {
  const selected = new SelectionScenario().parse([
    'execution',
    '--tag',
    'native',
    '--tag',
    'regression',
    '--level',
    'integration',
    '--native',
    'true',
  ]);
  assert.equal(selected.owner, 'execution');
  assert.deepEqual(selected.tags, ['native', 'regression']);
  assert.deepEqual(selected.levels, ['integration']);
  assert.equal(selected.native, true);
  const suites = foundation.testInventory(selected.owner, selected);
  assert(suites.length);
  assert(suites.every((entry) => entry.owner === 'execution' && entry.level === 'integration'));
  assert(suites.every((entry) => entry.tags.some((tag) => selected.tags.includes(tag))));
});

test('selection refuses unknown options, missing option values and unknown levels before execution', () => {
  const scenario = new SelectionScenario();
  for (const args of [
    ['--unknown'],
    ['--tag'],
    ['--level', 'unregistered'],
    ['--native', 'maybe'],
    ['one', 'two'],
  ])
    assert.throws(() => scenario.parse(args), /Unknown|Missing|native|owner/i);
});

test('an empty explicit test selection fails rather than reporting an unexecuted suite as passed', () => {
  const selection = new SelectionScenario().parse([
    'foundation',
    '--tag',
    'nonexistent-fixture-tag',
  ]);
  assert.throws(() => foundation.testInventory(selection.owner, selection), /No built test suites/);
});

test('suite metadata is literal, matches path ownership and never executes the suite to discover tags', () => {
  const owner = { id: 'foundation', owns: ['packages/foundation'] };
  const path = 'dist/packages/foundation/tests/unit/fixture.test.js';
  const register = foundation.registerSuite;
  const source =
    "export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const; throw new Error('must not execute');";
  assert.deepEqual(register(path, [owner], source).tags, ['regression']);
  assert.throws(
    () => register(path, [owner], source.replace("owner: 'foundation'", "owner: 'other'")),
    /owner/i,
  );
  assert.throws(
    () => register(path, [owner], source.replace("level: 'unit'", "level: 'acceptance'")),
    /level/i,
  );
  assert.throws(
    () => register(path, [owner], source.replace("['regression']", 'dynamicTags()')),
    /literal|tags/i,
  );
});

test('literal source paths select a file or directory without broadening owner scope', () => {
  const selection = new SelectionScenario().parse([
    'foundation',
    '--path',
    'packages/foundation/tests/unit/test-selection.test.ts',
  ]);
  const selected = foundation.testInventory(selection.owner, selection);
  assert.deepEqual(
    selected.map(({ file }) => file),
    ['dist/packages/foundation/tests/unit/test-selection.test.js'],
  );
  const foreign = new SelectionScenario().parse(['foundation', '--path', 'packages/execution']);
  assert.throws(() => foundation.testInventory(foreign.owner, foreign), /No built test suites/);
});

test('explicit native selection cannot report success when native execution is disabled', () => {
  const disabled = new SelectionScenario().parse(['--tag', 'native', '--native', 'false']);
  assert.throws(
    () => disabled.environment({ ARCNEXUS_NATIVE_TESTS: '1' }),
    /native.*disabled|native.*opt-in/i,
  );
  const enabled = new SelectionScenario().parse(['--tag', 'native', '--native', 'true']);
  assert.equal(enabled.environment({}).ARCNEXUS_NATIVE_TESTS, '1');
});
