import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { RecoveryScenario } from '../fixtures/checkpoint.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

test('retry confirms a lost checkpoint push, reconstructs the worktree and resumes the next steward', async (t) => {
  const scenario = new RecoveryScenario(t);
  const first = await scenario.run();
  assert.equal(first.kind, 'failed');
  assert.match(first.reason, /Checkpoint push reply lost/);
  assert.deepEqual(scenario.activations, ['first']);
  scenario.checkCleanup();

  const boundary = scenario.remote.events.length;
  const secured = scenario.remote.head;
  const retry = await scenario.run();
  const resumed = scenario.remote.events.slice(boundary).filter(({ branch }) => branch === '7-task');
  assert.deepEqual(resumed[0], { kind: 'observe', branch: '7-task', head: secured });
  assert(!resumed.some(({ kind, head }) => kind === 'push' && head === secured));
  assert.equal(scenario.identities[0], scenario.identities[1]);
  assert.equal(retry.kind, 'merged', JSON.stringify(retry));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.equal(scenario.remote.pushes.length, 2);
  assert.equal(dirname(scenario.artifacts[0]!), dirname(scenario.artifacts[1]!));
  assert.notEqual(scenario.artifacts[0], scenario.artifacts[1]);
  scenario.checkCleanup();
});

test('single-file tool checkpoints survive a refused write and interrupted push', async (t) => {
  const scenario = new RecoveryScenario(t, true);
  const interrupted = await scenario.run();
  assert.equal(interrupted.kind, 'failed');
  assert.match(interrupted.reason, /Checkpoint push reply lost/);
  assert.equal((await scenario.run()).kind, 'merged');
  assert.deepEqual(scenario.activations, ['first', 'first', 'second']);
  assert.equal(scenario.remote.pushes.length, 3);
  scenario.checkCleanup();
});

test('a secured checkpoint resumes on a disjoint staging advance', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  const stopped = await scenario.run();
  assert.equal(stopped.kind, 'failed');
  assert.match(stopped.reason, /Interrupted after secured checkpoint/);
  const { oldBase, checkpoint, staging } = scenario.advance('staging-only.txt', 'staging contribution');
  const checkedBlob = scenario.observe('rev-parse', `${checkpoint}:first.txt`);
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.equal(scenario.identities[0], scenario.identities[1]);
  assert.notEqual(scenario.worktrees[0], scenario.worktrees[1]);
  const recovered = scenario.observe('rev-parse', 'refs/heads/7-task');
  assert.equal(scenario.observe('merge-base', recovered, checkpoint), checkpoint);
  assert.equal(scenario.observe('merge-base', recovered, staging), staging);
  assert.equal(scenario.observe('rev-parse', `${recovered}:first.txt`), checkedBlob);
  assert.equal(scenario.observe('show', `${recovered}:staging-only.txt`), 'staging contribution');
  assert.notEqual(oldBase, staging);
  assert.ok(scenario.observe('rev-parse', `${recovered}^{tree}`));
});

for (const path of ['first.txt', 'shared.txt']) {
  test(`moved staging refuses ${path} without moving the secured branch`, async (t) => {
    const scenario = new RecoveryScenario(t, false, true, path === 'shared.txt');
    assert.equal((await scenario.run()).kind, 'failed');
    const { checkpoint } = scenario.advance(path, 'conflicting staging contribution');
    const resumed = await scenario.run();
    assert.equal(resumed.kind, 'failed');
    assert.match(resumed.reason, /CONFLICT/);
    assert.deepEqual(scenario.activations, ['first']);
    assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task'), checkpoint);
    assert.equal(scenario.remote.head, checkpoint);
    assert(!existsSync(scenario.worktrees[0]!));
  });
}

test('compatible changes in the same file survive moved staging recovery', async (t) => {
  const scenario = new RecoveryScenario(t, false, true, true);
  assert.equal((await scenario.run()).kind, 'failed');
  scenario.advance('shared.txt', 'top\n\nmiddle\n\nstaging\n');
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.equal(
    scenario.observe('show', 'refs/heads/7-task:shared.txt'),
    'steward\n\nmiddle\n\nstaging',
  );
  assert.deepEqual(scenario.activations, ['first', 'second']);
});

test('moved staging checks retained ownership instead of forbidding every architecture file change', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  scenario.advance('.arc/architecture/operations/example.yaml', 'id: example\n');
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.deepEqual(scenario.activations, ['first', 'second']);
});

test('a changed retained checked owner holds without moving the secured branch', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint } = scenario.advance('staging-only.txt', 'staging contribution');
  scenario.reassignFirstFile();
  const held = await scenario.run();
  assert.equal(held.kind, 'failed');
  assert.match(held.reason, /Retained checked owner changed: first.txt/);
  assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task'), checkpoint);
  assert.deepEqual(scenario.activations, ['first']);
});

test('an unavailable pending activity holds without replaying a completed contribution', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint } = scenario.advance('staging-only.txt', 'staging contribution');
  scenario.removePendingActivity();
  const held = await scenario.run();
  assert.equal(held.kind, 'failed');
  assert.match(held.reason, /Accepted pending activity is unavailable: owner\/implementation/);
  assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task'), checkpoint);
  assert.deepEqual(scenario.activations, ['first']);
});

test('a lost recovery push response reuses the retained merge checkpoint', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint, staging } = scenario.advance('staging-only.txt', 'staging contribution');
  scenario.remote.loseRecoveryPush = true;
  const missed = await scenario.run();
  assert.equal(missed.kind, 'failed');
  assert.match(missed.reason, /Checkpoint push reply lost/);
  const recovered = scenario.remote.head!;
  assert.equal(scenario.observe('merge-base', recovered, checkpoint), checkpoint);
  assert.equal(scenario.observe('merge-base', recovered, staging), staging);
  assert.equal((await scenario.run()).kind, 'merged');
  assert.equal(scenario.remote.pushes.length, 3);
  assert.deepEqual(scenario.activations, ['first', 'second']);
});

test('moved staging does not reconcile a branch with an existing pull request', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint } = scenario.advance('staging-only.txt', 'staging contribution');
  scenario.remote.published = {
    url: 'https://github.com/fixture/repo/pull/1',
    head: checkpoint,
    target: 'staging',
    state: 'open',
    commit: null,
  };
  const held = await scenario.run();
  assert.equal(held.kind, 'failed');
  assert.match(held.reason, /existing pull request/);
  assert.equal(scenario.remote.head, checkpoint);
  assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task'), checkpoint);
  assert.deepEqual(scenario.activations, ['first']);
});

test('proposed registry entries can advance without changing locked authority', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint, staging } = scenario.advance(
    'contracts.yaml',
    'contracts:\n- id: fixture/proposed\n  stage: proposed\n',
  );
  assert.equal((await scenario.run()).kind, 'merged');
  const recovered = scenario.observe('rev-parse', 'refs/heads/7-task');
  assert.equal(scenario.observe('merge-base', recovered, checkpoint), checkpoint);
  assert.equal(scenario.observe('merge-base', recovered, staging), staging);
});

test('moved staging holds when the observed issue branch diverges', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const { checkpoint, staging } = scenario.advance('staging-only.txt', 'staging contribution');
  scenario.remote.head = staging;
  const held = await scenario.run();
  assert.equal(held.kind, 'failed');
  assert.match(held.reason, /Remote checkpoint changed/);
  assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task'), checkpoint);
  assert.equal(scenario.remote.head, staging);
  assert.equal(scenario.remote.pushes.length, 1);
});

test('moved staging recovers an abandoned clean checkpoint workspace before merging the base', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  assert.equal((await scenario.run()).kind, 'failed');
  const path = scenario.abandonWorkspace();
  const { checkpoint } = scenario.advance('staging-only.txt', 'staging contribution');
  const blob = scenario.observe('rev-parse', `${checkpoint}:first.txt`);
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert(!existsSync(path));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.equal(scenario.observe('rev-parse', 'refs/heads/7-task:first.txt'), blob);
});
