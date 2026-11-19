import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { QualityFixture, selection } from './quality-fixture.js';

test('format checks a selected root filename beginning with a hyphen', async () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', '-probe.ts');
    tree.write('-probe.ts', 'export const probe = 1;\n');
    const selected = await selection(tree, 'format:check');
    assert.deepEqual(selected.files, ['-probe.ts']);
    const result = tree.run('format:check', 'alpha');
    assert.equal(result.status, 0, result.output);
  } finally {
    tree.close();
  }
});

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} rejects an unknown owner with its identity`, () => {
    const result = spawnSync('npm', ['run', operation, '--', 'missing-owner'], {
      encoding: 'utf8',
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /unknown.*owner.*missing-owner/i);
  });

  test(`${operation} rejects extra arguments`, () => {
    const result = spawnSync('npm', ['run', operation, '--', 'foundation', 'packages/team'], {
      encoding: 'utf8',
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
  });
}
