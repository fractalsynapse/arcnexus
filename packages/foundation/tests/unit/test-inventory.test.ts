import assert from 'node:assert/strict';
import test from 'node:test';
import { registerSuite, testInventory } from '../../src/index.js';

export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const;

test('test selection uses catalog ownership across the built app and package trees', () => {
  const all = testInventory();
  assert(all.some(({ owner }) => owner === 'cli-app'));
  assert(all.some(({ owner }) => owner === 'foundation'));
  assert.deepEqual(
    testInventory('cli-app'),
    all.filter(({ owner }) => owner === 'cli-app'),
  );
  assert.throws(() => testInventory('missing'), /Unknown test owner/);
});

test('suite registration preserves the built test path for the test runner', () => {
  const file = 'dist/packages/foundation/tests/unit/probe.test.js';
  const owner = { id: 'foundation', owns: ['packages/foundation'] };
  assert.equal(registerSuite(file, [owner]).file, file);
});

test('unowned suites, conflicting owners and unknown suite levels are refused', () => {
  const file = 'dist/apps/cli/tests/integration/feature.test.js';
  const cli = { id: 'cli-app', owns: ['apps/cli'] };
  assert.throws(() => registerSuite(file, []), /Expected one test owner/);
  assert.throws(
    () => registerSuite(file, [cli, { id: 'other', owns: ['apps'] }]),
    /Expected one test owner/,
  );
  assert.throws(
    () => registerSuite(file.replace('/integration/', '/fast/'), [cli]),
    /Invalid test level/,
  );
});
