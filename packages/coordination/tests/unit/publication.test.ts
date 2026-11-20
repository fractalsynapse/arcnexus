import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Coordination } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

test('retry retains the exact accepted publication for the identical goal', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-publication-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Coordination(directory);
  const remote = 'https://example.invalid/org/repo.git';
  const run = store.admit(remote, 'One goal');
  assert('record' in run);
  const publication = { branch: '10-task', head: 'accepted-head' };
  run.record({ publication });
  run.finish({ kind: 'cancelled' });
  run.close();
  const retry = store.admit(remote, 'One goal');
  assert('record' in retry);
  t.after(() => retry.close());
  assert.deepEqual(Reflect.get(retry, 'retained'), {
    run: run.run,
    events: [{ publication }, { outcome: { kind: 'cancelled' } }],
  });
});

test('only the same logical task can reclaim a departed publication writer', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-departed-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = 'https://example.invalid/org/repo.git';
  const goal = 'An interrupted goal';
  const moduleURL = new URL('../../src/index.js', import.meta.url).href;
  const code = `
    import { Coordination } from ${JSON.stringify(moduleURL)};
    const run = new Coordination(process.argv[1]).admit(process.argv[2], process.argv[3]);
    run.record({ publication: { branch: '10-task' } });
    run.close();
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', code, directory, remote, goal]);
  const store = new Coordination(directory);
  assert.deepEqual(store.admit(remote, 'Another goal'), { activeGoal: goal, run: 1 });
  const retry = store.admit(remote, goal, false);
  assert(retry && 'record' in retry);
  t.after(() => retry.close());
  assert.equal(retry.retained?.run, 1);
  assert.equal(retry.events().length, 1);
  assert.deepEqual(store.admit(remote, goal), { activeGoal: goal, run: retry.run });
});

test('round identities distinguish fresh evaluation from retrying identical goal text', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-round-id-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Coordination(directory);
  const remote = 'https://example.invalid/org/repo.git';
  const inventory = 'one stable inventory';
  const first = store.round(remote, () => inventory).id;
  const run = store.admit(remote, 'Identical goal text', true, `round:${first}:goal`);
  assert(run && 'record' in run);
  run.record({ issue: '10', position: { completed: 1, activities: {} } });
  run.finish({ kind: 'cancelled' });
  run.close();
  const changed = () => 'changed inventory';
  assert.deepEqual(store.round(remote, changed), { id: first, inventory });
  const resumed = store.admit(remote, 'Identical goal text', true, `round:${first}:goal`);
  assert(resumed && 'record' in resumed);
  assert.equal(resumed.taskID, run.taskID);
  assert(resumed.retained?.events.some((event) => JSON.stringify(event).includes('"issue":"10"')));
  resumed.finish({ kind: 'merged' });
  resumed.close();
  store.completeRound(remote, first);
  const fresh = store.round(remote, changed);
  assert.equal(fresh.inventory, 'changed inventory');
  const next = store.admit(remote, 'Identical goal text', true, `round:${fresh.id}:goal`);
  assert(next && 'record' in next);
  assert.equal(next.goalID, run.goalID);
  assert.notEqual(next.taskID, run.taskID);
  assert.equal(next.retained, undefined);
  next.close();
});

test('a completed round outcome is scoped to exact goal text and remains readable with an active writer', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-round-outcome-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Coordination(directory);
  const remote = 'https://example.invalid/org/repo.git';
  const goal = 'The first goal';
  const scope = 'round:1:first';
  const completed = { kind: 'satisfied', commit: 'staging', evidence: ['retained.log'] };
  const first = store.admit(remote, goal, true, scope);
  assert(first && 'record' in first);
  first.finish(completed);
  first.close();
  const later = store.admit(remote, 'The later goal', true, 'round:1:later');
  assert(later && 'record' in later);
  t.after(() => later.close());

  assert.equal(store.completedTask(remote, goal, scope), JSON.stringify(completed));
  assert.equal(store.completedTask(remote, goal, 'round:2:first'), undefined);
  assert.equal(store.completedTask(remote, goal + ' changed', scope), undefined);
  assert.equal(store.completedTask(remote, 'The later goal', 'round:1:later'), undefined);
  assert.deepEqual(store.admit(remote, goal, true, scope), {
    activeGoal: 'The later goal',
    run: later.run,
  });
});
