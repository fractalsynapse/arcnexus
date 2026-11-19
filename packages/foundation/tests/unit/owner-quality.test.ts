import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

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
