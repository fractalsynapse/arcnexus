import assert from 'node:assert/strict';
import test from 'node:test';
import type { HoldContext } from '../../../execution/src/index.js';
import { answer, correction, question } from '../../../execution/tests/fixtures/reviewed-hold.js';
import { RefusedWorkflow } from '../fixtures/refused-workflow.js';

export const suite = {
  owner: 'workflow',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * hold-exact-handoff/retained-continuity: the public Workflow first obtains an
 * independent rejection, then real Execution refuses schema.txt for its owner.
 * Reopen real SQLite/Git after the committed hold before Direction consumes it.
 * Exact structured feedback and readable retained artifacts reject a generic
 * diagnostic, fabricated check exit, lost receipt or current-attempt-only history.
 * Controlled assessment, model responses and transport do not prove live inference.
 */
test('independent rejection reaches Direction with exact checked-edit refusal after restart', async (t) => {
  const f = new RefusedWorkflow(t);
  await f.prepare();
  assert(!f.fixture.task.history().some((event) => 'verdict' in event));
  await interruptHeldActivation(f);
  const held = f.holds[0]!;
  const original = JSON.stringify(held);
  await f.reopen();
  assertRetained(f, held);
  await resumeCorrection(f, held);
  assert.equal(JSON.stringify(held), original);
});

/** Interrupt after Execution commits the refused activation, before Workflow can route its hold. */
async function interruptHeldActivation(f: RefusedWorkflow) {
  const first = await f.run({
    progress() {},
    event(event) {
      const observed = event.observation as { activation?: { outcome: { kind: string } } };
      if (observed.activation?.outcome.kind === 'blocked')
        throw new Error('Interrupt after the real refused activation is committed');
    },
  });
  assert.equal(first.kind, 'failed', JSON.stringify(first));
  assert.deepEqual(f.calls, ['original', 'Review', 'Direction:rejection', correction.id]);
  assert.equal(f.holds.length, 1);
}

/** Inspect the native Director request while its retained artifacts remain readable, then finish correction. */
async function resumeCorrection(f: RefusedWorkflow, held: HoldContext) {
  let observedHandoff = false;
  f.onHoldRevision = () => {
    assertHandoff(f, held);
    observedHandoff = true;
  };
  const resumed = await f.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert(observedHandoff);
  assert.deepEqual(f.calls, [
    'original',
    'Review',
    'Direction:rejection',
    correction.id,
    'Direction:hold',
    'refusal-correction',
    correction.id,
    'Review',
    'Delivery',
  ]);
}

/** Compare complete secured effects, answer bytes and rejection artifacts after reconstructing the task. */
function assertRetained(f: RefusedWorkflow, held: HoldContext) {
  const task = f.fixture.task;
  assert.equal(task.taskID, held.task.id);
  assert.equal(task.issue, held.task.issue);
  assert.equal(task.branch, held.task.branch);
  assert.equal(f.fixture.checkpoint(), held.task.checkpoint);
  assert.equal(held.answers.find((entry) => entry.question === question)?.answer, answer);
  assert.deepEqual(held.acceptance, correction.criteria);
  assert.deepEqual(held.rejection.findings, [f.fixture.rejection.findings[0]]);
  assertReceipts(f, held);
  for (const finding of held.rejection.findings)
    for (const path of finding.evidence)
      assert.equal(
        task.readFile(path).text,
        'Independent rejection A\nKeep the exact originating finding.\n',
      );
}

/** Require identical receipts with their original secured checkpoint association after reopening. */
function assertReceipts(f: RefusedWorkflow, held: HoldContext) {
  const receipts = f.fixture.task.observations<{
    editReceipt?: unknown;
    checkpoint?: { head: string };
  }>();
  assert(held.receipts.length);
  for (const receipt of held.receipts) {
    const event = receipts.find(
      (entry) => JSON.stringify(entry.editReceipt) === JSON.stringify(receipt),
    );
    assert(event);
    assert(
      held.receiptCheckpoints.some(
        (pair) => pair.receipt === receipt.id && pair.checkpoint === event.checkpoint?.head,
      ),
    );
  }
}

/** Require the actual refusal and complete host receipts at the native Director consumer boundary. */
function assertHandoff(f: RefusedWorkflow, held: HoldContext) {
  assert.equal(held.failure.operation, 'checked-edit');
  assert.equal(held.failure.check, undefined);
  const request = f.revisions[1]!;
  assert.equal(request.finding.kind, 'supplier');
  assert(request.finding.kind === 'supplier');
  assert.equal(request.finding.reason, held.failure.diagnostic);
  assert.equal(request.finding.failedCheck, undefined);
  assert(request.finding.reason.includes('schema.txt'));
  assert(request.finding.reason.includes('other'));
  const artifacts = request.finding.evidence.map((path) => f.fixture.task.readFile(path).text);
  assertHoldArtifact(artifacts, held);
  assertRefusal(f, held);
  const retained = f.fixture.task.readFile(request.retainedEvidence).text;
  for (const receipt of held.receipts) assert(retained.includes(receipt.id));
  const accepted = JSON.parse(f.fixture.task.readFile(request.acceptedPlan).text);
  assert.deepEqual(
    accepted.milestones.find((m: { id: string }) => m.id === correction.id).criteria,
    correction.criteria,
  );
}

/** Read the complete canonical hold rather than copying a growing transcript into later responses. */
function assertHoldArtifact(artifacts: string[], held: HoldContext) {
  const context = artifacts
    .map((text) => {
      try {
        return JSON.parse(text) as HoldContext;
      } catch {
        return undefined;
      }
    })
    .find((value) => value?.failure?.operation === 'checked-edit');
  assert.deepEqual(context, JSON.parse(JSON.stringify(held)));
}

/** Compare the actual host refusal path, owner and diagnostic with the handed-off failure. */
function assertRefusal(f: RefusedWorkflow, held: HoldContext) {
  const repairs = f.fixture.task
    .observations<{
      stewardRepair?: { diagnostic: string; path?: string; owners?: string[] };
    }>()
    .flatMap((event) => (event.stewardRepair ? [event.stewardRepair] : []));
  const refusal = repairs.find((repair) => repair.path === 'schema.txt');
  assert(refusal);
  assert.deepEqual(refusal.owners, ['other']);
  assert(held.failure.diagnostic.includes(refusal.diagnostic));
}
