import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../fixtures/project.js';

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Run the compiled CLI from a nested path in a generic target. */
function inspect(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, 'inspect', ...args], { cwd, encoding: 'utf8' });
}

test('GW-15, GW-17, GW-18: inspect prints complete captured context reproducibly', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'work');
  const result = inspect(cwd, 'work', 'testing');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, inspect(cwd, 'work', 'testing').stdout);
  for (const expected of [
    '<goal>',
    'Fixture root directive',
    'Fixture owner directive',
    'Fixture engineer instruction',
    'Component activity instruction',
    'Fixture standard body',
    'fixture-model',
    'integration-test',
  ]) {
    assert(result.stdout.includes(expected), expected);
  }
});

test('GW-20, GW-23, GW-24: inspect requires both positions and resolves special actors', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const args of [
    [],
    ['work'],
    ['work', 'testing', 'extra'],
    ['missing', 'testing'],
    ['work', 'missing'],
  ]) {
    const result = inspect(root, ...args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
  }
  for (const [actor, phase, message] of [
    ['director', 'planning', 'Fixture director instruction'],
    ['reviewer', 'assessment', 'Fixture reviewer instruction'],
  ] as const) {
    const result = inspect(root, actor, phase);
    assert.equal(result.status, 0, result.stderr);
    assert(result.stdout.includes(message));
  }
});
