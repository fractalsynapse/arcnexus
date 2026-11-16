import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Coordination } from '../../src/index.js';

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

test('only the same pending publication can reclaim a departed writer', (t) => {
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
