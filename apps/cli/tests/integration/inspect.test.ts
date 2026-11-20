import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../fixtures/project.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Run the compiled CLI from a nested path in a generic target. */
function inspect(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, 'inspect', ...args], { cwd, encoding: 'utf8' });
}

test('ARC-9, GW-15, GW-17, GW-18: inspect prints the selected activity reproducibly', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'work');
  const result = inspect(cwd, 'work', 'testing');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, inspect(cwd, 'work', 'testing').stdout);
  const [header, prompt] = result.stdout.split('--- Codex input ---\n');
  assert(header && prompt, 'inspection prints a header and prompt');
  for (const expected of [
    '<goal>',
    'Fixture engineer instruction',
    'Component activity instruction',
    'Fixture standard body',
    '.arc/architecture/operations/test.yaml',
    'fixture/work',
    'work/contract.md',
  ]) {
    assert(prompt.includes(expected), expected);
  }
  assert.match(header, /"model": "fixture-model"/);
  assert.match(header, /"workingDirectory": "<worktree>"/);
  assert.doesNotMatch(
    prompt,
    /Inactive activity instructions|Fixture \w+ directive|Fixture skill|Fixture contract body|fixture-model|operationCategories|<worktree>|<skills>/,
  );
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

test('GW-26: JSON placement errors leave stdout empty and input errors keep their diagnostics', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const args of [
    ['work', '--json', 'testing'],
    ['work', 'testing', '--json', '--json'],
    ['work', '--json'],
    ['missing', 'testing', '--json'],
  ]) {
    const result = inspect(root, ...args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.notEqual(result.stderr, '');
  }
  assert.equal(
    inspect(root, 'missing', 'testing', '--json').stderr.split('\n')[0],
    inspect(root, 'missing', 'testing').stderr.split('\n')[0],
  );
});

test('bare task run validates the goal inventory before admitting a task', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [cli, '--json', 'task', 'run'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No standing goals/);
});
