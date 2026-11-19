import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { reusableCheck } from '../../src/check-cache.js';
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

test('owner lint evidence survives an unrelated committed documentation edit', async (t) => {
  const { git } = await import('../../src/git.js');
  const fixture = new CheckCacheFixture(t);
  fixture.restart({
    ...fixtureOperation,
    command: 'npm',
    args: ['run', 'lint', '--', { context: 'owner' }],
    applicability: 'owner-lint-files',
  } as typeof fixtureOperation);
  const observed = fixture.observe();
  const worktree = fixture.task.worktree!;
  writeFileSync(join(worktree, 'unrelated.md'), 'unrelated documentation');
  git(worktree, 'add', 'unrelated.md');
  git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
    'commit', '-qm', 'Unrelated edit');
  assert.deepEqual(reusableCheck(fixture.task.observations(), fixture.input()), observed);
});

test('an imported lint configuration change invalidates owner lint evidence', async (t) => {
  const { git } = await import('../../src/git.js');
  const fixture = new CheckCacheFixture(t);
  fixture.restart({
    ...fixtureOperation, command: 'npm',
    args: ['run', 'lint', '--', { context: 'owner' }],
    applicability: 'owner-lint-files',
  } as typeof fixtureOperation);
  Object.assign(fixture.task.capture.components, {
    config: { id: 'config', owns: ['lint-rules.ts'], activities: {} },
  });
  const worktree = fixture.task.worktree!;
  writeFileSync(join(worktree, 'eslint.config.ts'), "import './lint-rules.ts';\n");
  writeFileSync(join(worktree, 'lint-rules.ts'), 'export default {};\n');
  git(worktree, 'add', 'eslint.config.ts', 'lint-rules.ts');
  git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
    'commit', '-qm', 'Add lint configuration');
  const before = fixture.input();
  fixture.observe();
  writeFileSync(join(worktree, 'lint-rules.ts'), 'export default { changed: true };\n');
  git(worktree, 'add', 'lint-rules.ts');
  git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
    'commit', '-qm', 'Change imported lint configuration');
  assert.notEqual(fixture.input(), before);
  assert.equal(reusableCheck(fixture.task.observations(), fixture.input()), undefined);
});

test('ownership drift is refused before reusing matching check evidence', async (t) => {
  const fixture = new CheckCacheFixture(t);
  fixture.restart({
    ...fixtureOperation, command: 'npm',
    args: ['run', 'lint', '--', { context: 'owner' }],
    applicability: 'owner-lint-files',
  } as typeof fixtureOperation);
  fixture.observe();
  const catalog = join(fixture.task.worktree!, '.arc/architecture/components');
  mkdirSync(catalog, { recursive: true });
  writeFileSync(join(catalog, 'owner.yaml'), 'id: owner\nowns:\n  - other.txt\n');
  await assert.rejects(
    fixture.task.check('fixture-check', new AbortController().signal, fixture.scope),
    /ownership drift/i,
  );
});

test('generated ignored output does not invalidate scoped lint evidence', async (t) => {
  const fixture = new CheckCacheFixture(t);
  fixture.restart({
    ...fixtureOperation, command: 'npm',
    args: ['run', 'lint', '--', { context: 'owner' }],
    applicability: 'owner-lint-files',
  } as typeof fixtureOperation);
  const observed = fixture.observe();
  mkdirSync(join(fixture.task.worktree!, 'node_modules'));
  writeFileSync(join(fixture.task.worktree!, 'node_modules', 'generated.js'), 'generated');
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

for (const path of [
  '.prettierrc',
  'nested/.prettierignore',
  'nested/.editorconfig',
]) {
  test(`committed quality configuration ${path} invalidates cached evidence`, async (t) => {
    const { git } = await import('../../src/git.js');
    const fixture = new CheckCacheFixture(t);
    fixture.restart({
      ...fixtureOperation, command: 'npm',
      args: ['run', 'format:check', '--', { context: 'owner' }],
      applicability: 'owner-format-files',
    } as typeof fixtureOperation);
    const before = fixture.input();
    fixture.observe();
    const worktree = fixture.task.worktree!;
    const { dirname } = await import('node:path');
    mkdirSync(dirname(join(worktree, path)), { recursive: true });
    writeFileSync(join(worktree, path), 'changed configuration');
    git(worktree, 'add', path);
    git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
      'commit', '-qm', 'Change configuration');
    assert.notEqual(fixture.input(), before);
    assert.equal(reusableCheck(fixture.task.observations(), fixture.input()), undefined);
  });
}
