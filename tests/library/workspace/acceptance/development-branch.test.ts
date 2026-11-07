import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import {
  assertIdentity,
  createWorkspace,
  prepareWorkspace,
} from '../../../../dist/library/workspace/workspace.js';
import { git } from '../../../../dist/library/operations/process.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { fixture } from '../support/workspace-fixture.js';

test('each steward branch starts at observed staging and retains verified candidate commits', async (t) => {
  const f = fixture(t);
  const staging = f.git('rev-parse', 'HEAD');
  f.git('switch', '-c', 'verified-dependencies', staging);
  writeFileSync(join(f.repo, 'source.txt'), 'verified dependency');
  f.commit();
  const candidate = f.git('rev-parse', 'HEAD');
  const options = { project: f.repo, base: candidate, branchBase: staging };
  mkdirSync(join(f.state, 'runs'), { recursive: true });
  const first = createWorkspace(f.state, options);
  const second = createWorkspace(f.state, options);
  for (const record of [first, second]) {
    await prepareWorkspace(f.state, record, new AbortController().signal);
    assert.equal(f.git('rev-parse', record.branch + '@{1}'), staging);
    assert.equal(f.git('rev-parse', record.branch), candidate);
  }
  assert.notEqual(first.branch, second.branch);
  assert.equal(f.git('rev-parse', 'staging'), staging);
  const stale = createWorkspace(f.state, { project: f.repo, base: staging, branchBase: candidate });
  await assert.rejects(
    prepareWorkspace(f.state, stale, new AbortController().signal),
    /missing commits/,
  );
  assert.equal(existsSync(stale.workspace), false);
});

test('a verified dependency uses a successor branch and preserves unfinished owner work', async (t) => {
  const f = fixture(t);
  mkdirSync(join(f.state, 'runs'), { recursive: true });
  const first = createWorkspace(f.state, { project: f.repo });
  await prepareWorkspace(f.state, first, new AbortController().signal);
  const ownBranch = first.branch;
  writeFileSync(join(first.workspace, 'source.txt'), 'unfinished edit');
  writeFileSync(join(f.repo, 'source.txt'), 'verified dependency');
  f.commit();
  const next = createWorkspace(f.state, { project: f.repo });
  await prepareWorkspace(f.state, next, new AbortController().signal);
  for (const record of [first, next])
    Object.assign(record, { executionRunId: 'run', assignmentId: 'owner-assignment' });
  writeFileSync(join(next.workspace, 'source.txt'), 'reconciled edit');
  assert.notEqual(next.branch, ownBranch);
  assert.equal(f.git('rev-parse', ownBranch), first.base);
  assert.equal(f.git('rev-parse', next.branch), next.base);
  assert.equal(readFileSync(join(first.workspace, 'source.txt'), 'utf8'), 'unfinished edit');
  assert.equal(readFileSync(join(next.workspace, 'source.txt'), 'utf8'), 'reconciled edit');
});

test('a published steward branch can continue without losing its archived evidence worktree', async (t) => {
  const f = fixture(t);
  mkdirSync(join(f.state, 'runs'), { recursive: true });
  const first = createWorkspace(f.state, { project: f.repo });
  await prepareWorkspace(f.state, first, new AbortController().signal);
  writeFileSync(join(first.workspace, 'source.txt'), 'verified edit');
  writeFileSync(join(f.repo, 'source.txt'), 'verified edit');
  f.commit();
  const published = f.git('rev-parse', 'HEAD');
  git(first.workspace, 'switch', '--detach', first.base);
  f.git('update-ref', 'refs/heads/' + first.branch, published, first.base);
  first.status = 'completed';
  first.developmentHead = published;
  assertIdentity(first);
  const next = createWorkspace(f.state, { project: f.repo });
  await prepareWorkspace(f.state, next, new AbortController().signal);
  for (const record of [first, next])
    Object.assign(record, { executionRunId: 'run', assignmentId: 'owner-assignment' });
  assert.notEqual(next.branch, first.branch);
  assert.equal(f.git('rev-parse', first.branch), published);
  assert.equal(readFileSync(join(first.workspace, 'source.txt'), 'utf8'), 'verified edit');
  assertIdentity(next);
});

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'development-branch'],
});
