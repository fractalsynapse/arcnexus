import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ActivationTools } from '../../src/activation-tools.js';
import { answer, checked, criterion, PreparedRecoveryFixture } from '../fixtures/prepared-recovery.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

interface Retained {
  baseRevision?: string;
  editReceipt?: { id: string; path: string; before: string | null; after: string | null };
  clarification?: { scope: string; question: string; answer?: string; evidence?: string };
  plan?: { milestones: Array<{ criteria: unknown[] }> };
}

/** Establish a real acknowledged file and exact answer before staging can move. */
async function interrupt(fixture: PreparedRecoveryFixture) {
  const first = await fixture.run();
  assert.equal(first.kind, 'failed', JSON.stringify(first));
  assert.match(first.reason, /Interrupted after checked receipt and verbatim answer/);
  const task = fixture.tasks[0]!;
  const history = fixture.observed[0]! as Retained[];
  const receipt = history.find((event) => event.editReceipt)?.editReceipt;
  const gate = history.find((event) => event.clarification?.answer !== undefined)?.clarification;
  assert(receipt && gate?.evidence);
  assert.equal(receipt.path, 'checked.txt');
  assert.equal(gate.answer, answer);
  assert.equal(JSON.parse(readFileSync(gate.evidence, 'utf8')).answer, answer);
  assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
  assert.equal(task.worktree, undefined);
  assert.equal(fixture.probes(task).at(-1).data.assignment.clarifications[0].answer, answer);
  return { task, history, receipt, gate };
}

/** Check the recovered source and request against actual new captured authority. */
function assertCapture(fixture: PreparedRecoveryFixture, staging: string) {
  const resumed = fixture.tasks[1]!;
  assert.equal(resumed.capture.source.revision, staging);
  assert.deepEqual(resumed.capture.components.work!.owns, ['baseline', 'checked.txt', 'staging.txt']);
  assert.deepEqual(resumed.capture.project.checks!.acceptance, ['fixture-check', 'current-check']);
  const probe = fixture.probes(resumed).at(-1);
  assert.deepEqual(probe.data.acceptance, [criterion]);
  assert(probe.input.includes('revision: ' + staging));
  assert(probe.input.includes('current-read'));
  assert.equal(probe.node, process.version);
  assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
  assert.equal(fixture.git('show', '7-task:staging.txt'), 'independent staging contribution');
}

/** Reject current-attempt-only history and rewritten receipt or original acceptance. */
function assertHistory(fixture: PreparedRecoveryFixture, original: Awaited<ReturnType<typeof interrupt>>) {
  const current = fixture.observed[1]! as Retained[];
  assert(current.some((event) => event.baseRevision === original.task.capture.source.revision));
  assert.deepEqual(current.flatMap((event) => event.editReceipt ?? []), [original.receipt]);
  assert.deepEqual(current.filter((event) => event.clarification?.answer !== undefined),
    original.history.filter((event) => event.clarification?.answer !== undefined));
  assert.deepEqual(current.find((event) => event.plan)?.plan?.milestones[0]!.criteria, [criterion]);
  assert.equal(fixture.tasks[1]!.taskID, original.task.taskID);
  assert.equal(fixture.tasks[1]!.issue, '7');
  assert.equal(fixture.issues, 1);
  assert.equal(fixture.plans, 1);
  assert.deepEqual(fixture.prompts, ['Which requirement must recovery preserve?']);
}

test('recovered activation receives the verbatim answer and original receipt under the new capture', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  const original = await interrupt(fixture);
  const { checkpoint, staging } = fixture.advance();
  const resumed = await fixture.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assertCapture(fixture, staging);
  assertHistory(fixture, original);
  const probe = fixture.probes(fixture.tasks[1]!).at(-1);
  assert.deepEqual(probe.data.assignment.clarifications, [{
    question: original.gate.question, answer,
  }], 'Recovered caller must receive the complete previously answered question');
  assert.equal(fixture.git('merge-base', '7-task', checkpoint), checkpoint);
  assert.equal(fixture.git('merge-base', '7-task', staging), staging);
  assert(!existsSync(join(fixture.root, 'checked.txt')));
});

for (const unavailable of [false, true]) {
  test('a newly captured ' + (unavailable ? 'missing activity' : 'changed owner') + ' refuses continuation', async (t) => {
    const fixture = new PreparedRecoveryFixture(t);
    const original = await interrupt(fixture);
    const { checkpoint } = fixture.advance();
    fixture.changeOwner(unavailable);
    const held = await fixture.run();
    assert.equal(held.kind, 'failed', JSON.stringify(held));
    assert.match(held.reason, unavailable
      ? /Accepted pending activity is unavailable: work\/implementation/
      : /Retained checked owner changed: checked.txt/);
    assert.equal(fixture.git('rev-parse', '7-task'), checkpoint);
    assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
    assert.equal(fixture.tasks[1]!.taskID, original.task.taskID);
    assert.equal(fixture.probes(fixture.tasks[1]!).length, fixture.probes(original.task).length);
    assert.equal(fixture.prompts.length, 1);
  });
}

test('conflicting checked bytes remain secured with complete conflict diagnostics', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  await interrupt(fixture);
  const { checkpoint, staging } = fixture.advance('checked.txt', 'conflicting staging bytes\n');
  const held = await fixture.run();
  assert.equal(held.kind, 'failed', JSON.stringify(held));
  assert.match(held.reason, /CONFLICT \(add\/add\): Merge conflict in checked.txt/);
  assert.match(held.reason, /Auto-merging checked.txt/);
  assert.equal(fixture.git('rev-parse', '7-task'), checkpoint);
  assert.equal(fixture.git('show', checkpoint + ':checked.txt') + '\n', checked);
  assert.equal(fixture.git('show', staging + ':checked.txt'), 'conflicting staging bytes');
  assert.equal(fixture.checkpoints.at(-1), checkpoint);
  assert.equal(fixture.prompts.length, 1);
});

test('another staging advance requires a second recovery before activation', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  await interrupt(fixture);
  const first = fixture.advance();
  const prepare = ExecutionPreparation(fixture);
  await prepare();
  const second = fixture.advance('staging.txt', 'second staging contribution\n');
  const resumed = await fixture.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.equal(fixture.tasks.at(-1)!.capture.source.revision, second.staging);
  assert.equal(fixture.git('merge-base', '7-task', first.staging), first.staging);
  assert.equal(fixture.git('merge-base', '7-task', second.staging), second.staging);
  assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
  assert.equal(fixture.git('show', '7-task:staging.txt'), 'second staging contribution');
});
