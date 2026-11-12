import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { TaskWaitScenarios } from '../support/task-wait-scenarios.js';
import { RunQueryFixture } from '../support/run-query-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Reads a streaming readout as event objects, ignoring blank output. */
const readoutLines = (text: string | undefined): any[] =>
  (text ?? '')
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

test('empty run lists never create state or require a repository', (t) => {
  const f = new RunQueryFixture(t);
  assert.deepEqual(f.value('task', 'list').items, []);
  assert.deepEqual(f.value('workday', 'list').items, []);
  assert.equal(existsSync(f.state), false);
});

test('retained task and workday queries read authoritative state without recovery', (t) => {
  const f = new RunQueryFixture(t);
  const { task, workday } = f.seed();
  const path = join(f.state, 'projects/first/execution.sqlite');
  const before = readFileSync(path);
  const result = f.value('task', 'get', task.id);
  assert.equal(result.run.status, 'running');
  assert.equal(result.run.id, task.id);
  assert.ok(result.revision);
  assert.ok(result.events.every((event: any) => event.data.id === task.id));
  assert.equal(f.value('workday', 'get', workday.id).run.status, 'idle');
  assert.equal(f.command('task', 'get', workday.id).status, 2);
  assert.deepEqual(readFileSync(path), before);
  assert.ok(
    readdirSync(join(f.state, 'projects/first')).every((name) =>
      name.startsWith('execution.sqlite'),
    ),
  );
});

test('run lists intersect typed filters with case-insensitive search', (t) => {
  const f = new RunQueryFixture(t);
  const { task } = f.seed();
  const filtered = f.value(
    'task',
    'list',
    'status=running',
    'packageId=package-a',
    '--search',
    'ALPHA',
  );
  assert.deepEqual(
    filtered.items.map((item: any) => item.id),
    [task.id],
  );
});

test('run pagination binds cursors to a stable query and result revision', (t) => {
  const f = new RunQueryFixture(t);
  const { task, other } = f.seed();
  const page = f.value('task', 'list', '--limit', '1');
  const next = f.value('task', 'list', '--limit', '1', '--cursor', page.nextCursor);
  assert.deepEqual(
    next.items.map((item: any) => item.id),
    [other.id],
  );
  assert.equal(next.nextCursor, null);
  assert.equal(
    f.command('task', 'list', '--limit', '1', '--search', 'Beta', '--cursor', page.nextCursor)
      .status,
    2,
  );
  const writer = f.store();
  writer.updateRun(task.id, 'completed');
  writer.close();
  assert.equal(f.command('task', 'list', '--limit', '1', '--cursor', page.nextCursor).status, 2);
});

test('run query options reject unsupported filters and invalid cursors', (t) => {
  const f = new RunQueryFixture(t);
  f.seed();
  for (const args of [
    ['unknown=value'],
    ['status=invented'],
    ['--limit', '0'],
    ['--limit', '1.5'],
    ['--cursor', 'invalid'],
    ['--model', 'override'],
    ['--after', '1'],
  ])
    assert.equal(f.command('task', 'list', ...args).status, 2);
});

test(
  'interrupting a run follower detaches without cancelling durable work',
  { timeout: 15000 },
  async (t) => {
    const f = new RunQueryFixture(t);
    const { task } = f.seed();
    const child = spawn(process.execPath, [f.cli, 'task', 'follow', task.id, '--json'], {
      cwd: f.root,
      env: f.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => child.kill('SIGKILL'));
    const exit = once(child, 'exit');
    const output = await Promise.race([once(child.stdout, 'data'), exit]);
    assert.ok(Buffer.isBuffer(output[0]), 'Follower exited before presenting retained evidence');
    child.kill('SIGINT');
    assert.equal((await exit)[0], 0);
    assert.equal(f.value('task', 'get', task.id).run.status, 'running');
  },
);

test('event cursors retain correlated updates and omit unrelated run activity', (t) => {
  const f = new RunQueryFixture(t);
  const { task, other } = f.seed();
  const initial = f.value('task', 'get', task.id);
  const writer = f.store();
  writer.updateRun(other.id, 'completed');
  writer.updateRun(task.id, 'completed');
  writer.close();
  // Following is the streaming readout: one JSON object per stored event on stdout, not an object
  // wrapping an events array. The correlation guarantee is unchanged - only this run's events
  // appear - so the assertions read lines rather than a projection that no longer exists.
  const followed = f.command('task', 'get', task.id, '--follow', '--after', String(initial.cursor));
  assert.equal(followed.status, 0, followed.stderr);
  const lines = readoutLines(followed.stdout);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, task.id);
  assert.equal(lines[0].status, 'completed');
  assert.ok(lines[0].sequence > initial.cursor);
  const empty = f.command('task', 'follow', task.id, '--after', String(lines[0].sequence));
  assert.deepEqual(readoutLines(empty.stdout), []);
});

const waits = new TaskWaitScenarios();

test('task status lists outstanding waits in stable owner/assignment/escalation order', (t) =>
  waits.outstanding(t));

test('task status without waits preserves existing terminal bytes', (t) => waits.absent(t));

test('resolved-only task status preserves existing terminal bytes', (t) => waits.resolved(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
