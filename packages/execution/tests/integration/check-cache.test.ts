import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { reusableCheck } from '../../src/check-cache.js';
import { CheckCacheFixture, fixtureOperation } from '../fixtures/check-cache.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

test('a validated observation survives unchanged setup and reconstruction at another worktree path', async (t) => {
  const fixture = new CheckCacheFixture(t);
  const result = fixture.observe();
  fixture.task.note({ checkpoint: 'same checkpoint', baseRevision: 'same base' });
  assert.deepEqual(
    await fixture.task.check('fixture-check', new AbortController().signal, fixture.scope),
    result,
  );
  fixture.restart();
  assert.deepEqual(
    await fixture.task.check('fixture-check', new AbortController().signal, fixture.scope),
    result,
  );
});

test('a changed actual checkpoint invalidates earlier evidence', (t) => {
  const fixture = new CheckCacheFixture(t);
  const before = fixture.input();
  fixture.observe();
  fixture.change();
  const after = fixture.input();
  assert.notEqual(after, before);
  assert.equal(reusableCheck(fixture.task.observations(), after), undefined);
});

test('a later failure remains pending and is returned instead of an earlier success or another execution', async (t) => {
  const fixture = new CheckCacheFixture(t);
  const earlier = fixture.observe();
  const check = {
    ...earlier,
    status: 37,
    log: fixture.task.store('later-failure.log', 'controlled later failure'),
  };
  fixture.task.note({ check, scope: fixture.scope, checkInput: fixture.input() });
  assert.deepEqual(reusableCheck(fixture.task.observations(), fixture.input()), check);
  const repeated = await fixture.task.check(
    'fixture-check',
    new AbortController().signal,
    fixture.scope,
  );
  assert.deepEqual(repeated, check);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.log, check.log);
});

test(
  'a real confined failure is reused until the actual checkpoint changes',
  {
    skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1',
  },
  async (t) => {
    const fixture = new CheckCacheFixture(t);
    fixture.restart({
      ...fixtureOperation,
      command: '/usr/bin/node',
      args: [
        '-e',
        "const status=require('node:fs').readFileSync('fixture.txt','utf8')==='original'?37:0; console.log('fixture exit '+status); process.exit(status)",
      ],
    });
    const signal = new AbortController().signal;
    const failed = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(failed.status, 37);
    const repeated = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(repeated.status, 37);
    assert.equal(repeated.log, failed.log);
    assert.equal(readFileSync(failed.log, 'utf8'), 'fixture exit 37\n');
    fixture.change();
    const passed = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(passed.status, 0);
    assert.notEqual(passed.log, failed.log);
  },
);

test('changed installed dependencies invalidate matching source evidence', (t) => {
  const fixture = new CheckCacheFixture(t);
  const before = fixture.input();
  fixture.observe();
  mkdirSync(join(fixture.source, 'node_modules'));
  writeFileSync(
    join(fixture.source, 'node_modules', '.package-lock.json'),
    '{"dependencies":"changed"}',
  );
  assert.notEqual(fixture.input(), before);
});

test(
  'a silent real confined check retains an empty log and reuses its observation',
  {
    skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1',
  },
  async (t) => {
    const fixture = new CheckCacheFixture(t);
    const signal = new AbortController().signal;
    const result = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(result.log, 'utf8'), '');
    const repeated = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(repeated.log, result.log);
  },
);

test('a missing latest failure log cannot expose an older success', (t) => {
  const fixture = new CheckCacheFixture(t);
  const earlier = fixture.observe();
  const log = fixture.task.store('missing-failure.log', 'controlled failure');
  const check = { ...earlier, status: 37, log };
  fixture.task.note({ check, scope: fixture.scope, checkInput: fixture.input() });
  unlinkSync(log);
  assert.equal(reusableCheck(fixture.task.observations(), fixture.input()), undefined);
});

test('dirty inputs and legacy observations without input provenance are never reused', (t) => {
  const fixture = new CheckCacheFixture(t);
  const check = fixture.observe();
  assert.equal(reusableCheck([{ check, scope: fixture.scope }], fixture.input()), undefined);
  writeFileSync(join(fixture.task.worktree!, 'fixture.txt'), 'uncommitted');
  assert.equal(fixture.input(), undefined);
});

for (const operation of [
  { ...fixtureOperation, cwd: '/tmp' },
  { ...fixtureOperation, cwd: '..' },
  { ...fixtureOperation, network: true },
  { ...fixtureOperation, args: [{ context: 'unresolved' }] },
]) {
  test(`captured confinement is validated before reuse: ${JSON.stringify(operation)}`, async (t) => {
    const fixture = new CheckCacheFixture(t);
    fixture.observe();
    fixture.restart(operation as typeof fixtureOperation);
    await assert.rejects(
      fixture.task.check('fixture-check', new AbortController().signal, fixture.scope),
      /escapes|Unavailable|Unresolved/,
    );
  });
}

test('a cancelled request cannot reuse an otherwise valid observation', async (t) => {
  const fixture = new CheckCacheFixture(t);
  fixture.observe();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fixture.task.check('fixture-check', controller.signal, fixture.scope), {
    name: 'AbortError',
  });
});
