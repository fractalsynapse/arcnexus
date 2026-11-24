import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { textDigest } from '../../../foundation/src/index.js';
import { type HostTask } from '../../src/index.js';
import { RecoveryScenario } from '../fixtures/checkpoint.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

interface Acknowledgment {
  receipt: { id: string; path: string; before: null; after: string };
  artifact: string;
  taskID: string;
  issue: string;
  branch: string;
  worktree: string;
  node: string;
}

/** Run the actual checkpoint writer in a child that cannot execute Workflow's cleanup. */
function crash(scenario: RecoveryScenario, t: TestContext): Acknowledgment {
  const executable = process.execPath;
  const args = [
    fileURLToPath(new URL('../fixtures/checkpoint-crash-child.js', import.meta.url)),
    dirname(scenario.root),
  ];
  const result = spawnSync(executable, args, { encoding: 'utf8' });
  t.diagnostic(JSON.stringify({
    executable, args, node: process.version, status: result.status,
    signal: result.signal, stdout: result.stdout, stderr: result.stderr,
  }));
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 73, result.stderr);
  const path = join(dirname(scenario.root), 'acknowledgment.json');
  const ack = JSON.parse(readFileSync(path, 'utf8')) as Acknowledgment;
  t.diagnostic(JSON.stringify({ acknowledged: ack }));
  return ack;
}

/** Observe acknowledged bytes and the abandoned real checkout before ordinary admission. */
function abandoned(scenario: RecoveryScenario, ack: Acknowledgment) {
  assert.equal(ack.node, process.version);
  assert.equal(ack.issue, '7');
  assert.equal(ack.branch, '7-task');
  assert.equal(ack.receipt.path, 'first.txt');
  assert.equal(ack.receipt.before, null);
  assert.equal(ack.receipt.after, textDigest('first'));
  assert.deepEqual(JSON.parse(readFileSync(ack.artifact, 'utf8')), ack.receipt);
  assert(existsSync(ack.worktree));
  assert.equal(readFileSync(join(ack.worktree, 'first.txt'), 'utf8'), 'first');
  assert.equal(scenario.observe('show', '7-task:first.txt'), 'first');
  assert.equal(scenario.observe('status', '--porcelain'), '');
  assert(scenario.observe('worktree', 'list', '--porcelain').includes(ack.worktree));
}

/** Reject activation before reconciliation, duplicate receipt effects or lost original artifacts. */
function recovered(task: HostTask, scenario: RecoveryScenario, ack: Acknowledgment) {
  assert.equal(task.taskID, ack.taskID);
  assert.equal(task.issue, ack.issue);
  assert.equal(task.branch, ack.branch);
  assert(task.worktree);
  assert.notEqual(task.worktree, ack.worktree);
  assert(!existsSync(ack.worktree));
  assert.equal(readFileSync(join(task.worktree, 'first.txt'), 'utf8'), 'first');
  assert(task.evidence.includes(ack.artifact));
  assert.deepEqual(JSON.parse(readFileSync(ack.artifact, 'utf8')), ack.receipt);
  const receipts = task.observations<{ editReceipt?: Acknowledgment['receipt'] }>()
    .flatMap(({ editReceipt }) => editReceipt?.path === 'first.txt' ? [editReceipt] : []);
  assert.deepEqual(receipts, [ack.receipt]);
  const edits = task.observations<{ editIntent?: { path: string }[] }>()
    .flatMap(({ editIntent }) => editIntent ?? []).filter(({ path }) => path === 'first.txt');
  assert.equal(edits.length, 1);
  assert.equal(scenario.observe('worktree', 'list', '--porcelain').split('worktree ').length, 4);
}

test('abrupt acknowledged edit recovers its original receipt before activation and cleans only task worktrees', async (t) => {
  const scenario = new RecoveryScenario(t, true);
  scenario.remote.loseFirstPush = false;
  const unrelated = join(dirname(scenario.root), 'unrelated');
  scenario.observe('worktree', 'add', '--detach', unrelated, 'HEAD');
  const ack = crash(scenario, t);
  abandoned(scenario, ack);
  scenario.beforeActivation = (task) => recovered(task, scenario, ack);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'merged', JSON.stringify(outcome));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.deepEqual(scenario.identities, [ack.taskID]);
  assert.equal(scenario.remote.issues, 0);
  assert.equal(scenario.observe('show', '7-task:first.txt'), 'first');
  for (const path of [ack.worktree, ...scenario.worktrees]) assert(!existsSync(path));
  assert(existsSync(unrelated));
  assert.equal(scenario.observe('worktree', 'list', '--porcelain').split('worktree ').length, 3);
});
