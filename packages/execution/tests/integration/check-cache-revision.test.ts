import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { StewardFixture } from '../fixtures/steward.js';

test('a changed checkpoint cannot reuse an observation for a different captured operation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-check-revision-'));
  const task = new StewardFixture(t, root).task;
  Object.assign(task.capture, { operations: {} });
  t.after(() => task.close());
  const scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
  const log = task.store('old-check.log', 'old source passed');
  writeFileSync(join(root, 'fixture.txt'), 'old source');
  task.note({
    check: {
      id: 'owner-tests',
      status: 0,
      command: '/usr/bin/true',
      args: [],
      cwd: root,
      durationMs: 1,
      log,
    },
    scope,
  });
  writeFileSync(join(root, 'fixture.txt'), 'changed source');
  task.note({ checkpoint: 'new checkpoint', baseRevision: 'new base' });

  await assert.rejects(
    task.check('owner-tests', new AbortController().signal, scope),
    /Unavailable confined operation: owner-tests/,
  );
});

test('an unchanged checkpoint retains matching evidence', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-check-checkpoint-'));
  const task = new StewardFixture(t, root).task;
  Object.assign(task.capture, {
    operations: { 'owner-tests': { command: '/usr/bin/true', args: [], network: false, cwd: '.' } },
  });
  t.after(() => task.close());
  const scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
  const log = task.store('old-check.log', 'old source passed');
  const check = {
    id: 'owner-tests',
    status: 0,
    command: '/usr/bin/true',
    args: [],
    cwd: root,
    durationMs: 1,
    log,
  };
  task.note({ check, scope });
  assert.deepEqual(await task.check('owner-tests', new AbortController().signal, scope), check);
  task.note({ checkpoint: 'unchanged', baseRevision: 'same' });
  const refreshed = await task.check('owner-tests', new AbortController().signal, scope);
  assert.deepEqual(refreshed, check);
});

test('an aborted check cannot reuse completed evidence', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-check-aborted-cache-'));
  const task = new StewardFixture(t, root).task;
  Object.assign(task.capture, {
    operations: { 'owner-tests': { command: '/usr/bin/true', args: [], network: false, cwd: '.' } },
  });
  t.after(() => task.close());
  const scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
  const log = task.store('old-check.log', 'passed');
  task.note({
    check: {
      id: 'owner-tests',
      status: 0,
      command: '/usr/bin/true',
      args: [],
      cwd: root,
      durationMs: 1,
      log,
    },
    scope,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(task.check('owner-tests', controller.signal, scope), { name: 'AbortError' });
});

test('an absolute captured cwd cannot reuse completed evidence', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-check-cwd-cache-'));
  const task = new StewardFixture(t, root).task;
  Object.assign(task.capture, {
    operations: {
      'owner-tests': { command: '/usr/bin/true', args: [], network: false, cwd: root },
    },
  });
  t.after(() => task.close());
  const scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
  const log = task.store('old-check.log', 'passed');
  task.note({
    check: {
      id: 'owner-tests',
      status: 0,
      command: '/usr/bin/true',
      args: [],
      cwd: root,
      durationMs: 1,
      log,
    },
    scope,
  });
  await assert.rejects(
    task.check('owner-tests', new AbortController().signal, scope),
    /working directory escapes the worktree/,
  );
});
