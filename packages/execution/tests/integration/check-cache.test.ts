import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { reusableCheck } from '../../src/check-cache.js';
import { git } from '../../src/git.js';
import { CheckCacheFixture, fixtureOperation } from '../fixtures/check-cache.js';

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

test('an unrelated committed edit preserves scoped operation evidence', (t) => {
  const fixture = new CheckCacheFixture(t);
  const before = fixture.input();
  const observed = fixture.observe();
  const worktree = fixture.task.worktree!;
  writeFileSync(join(worktree, 'unrelated.txt'), 'another owner');
  git(worktree, 'add', 'unrelated.txt');
  git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
    'commit', '-qm', 'Unrelated change');
  assert.equal(fixture.input(), before);
  assert.deepEqual(reusableCheck(fixture.task.observations(), fixture.input()), observed);
});

test('changed operation authority invalidates a retained successful observation', (t) => {
  const fixture = new CheckCacheFixture(t);
  const before = fixture.input();
  fixture.observe();
  fixture.restart({ ...fixtureOperation, args: ['changed'] });
  assert.notEqual(fixture.input(), before);
  assert.equal(reusableCheck(fixture.task.observations(), fixture.input()), undefined);
});

test('a later failure for unchanged inputs supersedes an earlier success', (t) => {
  const fixture = new CheckCacheFixture(t);
  const earlier = fixture.observe();
  const check = {
    ...earlier,
    status: 37,
    log: fixture.task.store('later-failure.log', 'controlled later failure'),
  };
  fixture.task.note({ check, scope: fixture.scope, checkInput: fixture.input() });
  assert.equal(reusableCheck(fixture.task.observations(), fixture.input()), undefined);
});

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

test('dirty inputs and legacy observations without input provenance are never reused', (t) => {
  const fixture = new CheckCacheFixture(t);
  const check = fixture.observe();
  assert.equal(reusableCheck([{ check, scope: fixture.scope }], fixture.input()), undefined);
  writeFileSync(join(fixture.task.worktree!, 'fixture.txt'), 'uncommitted');
  assert.equal(fixture.input(), undefined);
});

for (const path of ['new.test.ts', 'tsconfig.json', 'eslint.config.ts']) {
  test(`an uncommitted ${path} invalidates retained evidence`, (t) => {
    const fixture = new CheckCacheFixture(t);
    fixture.observe();
    writeFileSync(join(fixture.task.worktree!, path), 'changed input');
    assert.equal(fixture.input(), undefined);
  });
}

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
