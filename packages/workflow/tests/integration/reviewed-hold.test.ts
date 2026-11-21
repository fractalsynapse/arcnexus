import assert from 'node:assert/strict';
import test from 'node:test';
import { type Plan, type RevisionRequest } from '../../../direction/src/index.js';
import type { TaskObserver } from '../../src/index.js';
import { type HoldContext } from '../../../execution/src/index.js';
import { correction } from '../../../execution/tests/fixtures/reviewed-hold.js';
import { gateAnswer, gateQuestion, ReviewedWorkflow } from '../fixtures/reviewed-hold.js';

export const suite = {
  owner: 'workflow',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * reviewed-hold-correction/continuity: Workflow.run consumes real Execution holds
 * from the preceding Execution contribution after its retained independent rejection.
 * The original verdict is a public durable fixture; final assessment is controlled.
 * reviewed-hold-sequential-split: native decoding, real receipts and checkpoint
 * interruption reject altered acceptance, premature successors and duplicate replay.
 * reviewed-hold-progress-stop: equivalent logs and incidental edits cannot renew
 * correction; relevant secured successive inputs must continue.
 * reviewed-hold-prerequisite-gates: unanswered decisions and missing external
 * artifacts stop dependents until actual answer/artifact observation on restart.
 * Exact native revision payloads reject diagnostic/log loss and altered acceptance.
 * Secured sequential contributions reject early caller resume and shallow splitting.
 * Reopening real SQLite/Git rejects lost answers, checkpoint replacement and replay.
 * Controlled model, remote transport and review services do not prove live inference,
 * native confinement or hosted delivery.
 */
test('reviewed holds reach native Direction and sequential checked corrections before fresh review', async (t) => {
  const f = new ReviewedWorkflow(t, 'split');
  await f.prepare();
  const result = await f.run();
  assert.equal(f.revisions.length, 1, 'A repairable reviewed hold must reach Direction');
  assert.equal(result.kind, 'merged');
  assert.deepEqual(f.calls, [
    correction.id,
    'Direction',
    'part-a',
    'part-b',
    correction.id,
    'Review',
    'Delivery',
  ]);
  assert.equal(f.reviews.length, 1);
  assert.equal(f.holds[0]!.failure.check!.status, 37);
  assert.equal(f.holds[0]!.failure.diagnostic, 'Error: reviewed behavior still fails');
  assert(f.holds[0]!.failure.check!.log);
});

test('equivalent holds with new artifacts stop before another automatic correction and remain held on restart', async (t) => {
  const f = new ReviewedWorkflow(t, 'repeat');
  await f.prepare();
  const result = await f.run();
  assert.equal(
    f.revisions.length,
    1,
    'The initial repairable hold must first permit concrete correction',
  );
  assert.equal(result.kind, 'blocked');
  assert.deepEqual(f.calls, [correction.id, 'Direction', 'part-1', correction.id]);
  assert.equal(f.holds.length, 2);
  assert.notEqual(f.holds[0]!.failure.check!.log, f.holds[1]!.failure.check!.log);
  assert.equal(f.holds[0]!.progress.identity, f.holds[1]!.progress.identity);
  assert('reason' in result);
  assert(result.reason.includes('original-criterion'));
  assert(result.reason.includes(f.holds[1]!.failure.diagnostic));
  assert.match(result.reason, /action|correct|resolve/i);
  assert(result.evidence.includes(f.holds[1]!.failure.check!.log));
  const before = [...f.calls];
  await f.reopen();
  assert.equal((await f.run()).kind, 'blocked');
  assert.deepEqual(f.calls, before, 'Restart alone cannot renew an unchanged automatic attempt');
  assert.equal(f.reviews.length, 0);
  await resumeCheckedProgress(f);
});

/**
 * Reject replay of a historical hold after new relevant host observations.
 * The same task must retain the original checkpoint and complete answers, then
 * observe a real checked edit/check before fresh assessment can permit delivery.
 */
async function resumeCheckedProgress(f: ReviewedWorkflow) {
  const held = f.holds.at(-1)!;
  const original = JSON.stringify(held);
  await f.reopen();
  assertReopenedHold(f, held);
  const receipt = await f.fixture.edit('fixture.txt', 'corrected');
  const checked = await f.recheck();
  assert.equal(checked.status, 0);
  assert.notEqual(checked.log, held.failure.check!.log);
  assert.notEqual(f.fixture.checkpoint(), held.task.checkpoint);
  assert(f.fixture.task.readFile(checked.log).text !== undefined);
  assert.equal(f.reviews.length, 0, 'New checked evidence alone cannot accept the task');
  assertCheckedProgress(f, receipt, checked.log);
  const resumed = await f.run();
  assert.equal(resumed.kind, 'merged', 'Relevant checked progress must release the retained hold');
  assert.deepEqual(f.calls.slice(-3), [correction.id, 'Review', 'Delivery']);
  assert.equal(
    f.reviews.length,
    1,
    'The corrected candidate requires fresh independent assessment',
  );
  assert.equal(JSON.stringify(held), original, 'Historical findings and evidence remain immutable');
}

/** Compare reconstructed task identity and secured bytes with the actual held activation. */
function assertReopenedHold(f: ReviewedWorkflow, held: HoldContext) {
  assert.equal(f.fixture.task.taskID, held.task.id);
  assert.equal(f.fixture.task.issue, held.task.issue);
  assert.equal(f.fixture.task.branch, held.task.branch);
  assert.equal(f.fixture.checkpoint(), held.task.checkpoint);
}

/** Require retained Execution receipts and unchanged acceptance before resuming the original task. */
function assertCheckedProgress(f: ReviewedWorkflow, receipt: unknown, log: string) {
  assert.equal(f.fixture.task.readFile('fixture.txt').text, 'corrected');
  const observations = f.fixture.task.observations<{ editReceipt?: unknown }>();
  assert(
    observations.some((event) => JSON.stringify(event.editReceipt) === JSON.stringify(receipt)),
  );
  assert.equal(f.fixture.task.readFile(log).path, log);
  const plan = f.fixture.task.history().findLast((event) => 'plan' in event)!.plan!;
  assert.deepEqual(
    plan.milestones.find((m) => m.id === correction.id)!.criteria,
    correction.criteria,
  );
}

test('meaningful successive checked corrections continue despite the same diagnostic', async (t) => {
  const f = new ReviewedWorkflow(t, 'progress');
  await f.prepare();
  const result = await f.run();
  assert.equal(
    f.revisions.length,
    3,
    'Each relevant secured correction permits the next runnable contribution',
  );
  assert.equal(result.kind, 'merged');
  assert.deepEqual(f.calls, [
    correction.id,
    'Direction',
    'part-1',
    correction.id,
    correction.id,
    'Direction',
    'part-2',
    correction.id,
    correction.id,
    'Direction',
    'part-3',
    correction.id,
    'Review',
    'Delivery',
  ]);
  assert.equal(new Set(f.holds.map((h) => h.progress.identity)).size, f.holds.length);
  assert.equal(new Set(f.holds.map((h) => h.failure.diagnostic)).size, 1);
});

for (const scenario of ['human', 'external'] as const) {
  test(`${scenario} prerequisite retains position and resumes only after observed satisfaction`, async (t) => {
    const f = new ReviewedWorkflow(t, scenario);
    await f.prepare();
    f.fixture.task.ask = async () => undefined;
    const first = await f.run();
    assert.equal(first.kind, 'blocked');
    const held = f.holds[0]!;
    assert(held.prerequisite);
    assert.equal(held.prerequisite.satisfied, false);
    assert.equal(
      held.prerequisite.requiredAction,
      scenario === 'human'
        ? gateQuestion
        : 'Supply the approved external schema before correction.',
    );
    assert.equal(f.revisions.length, 0);
    assert.deepEqual(f.calls, [correction.id]);
    assert.equal(f.reviews.length, 0);
    assert('reason' in first);
    assert(
      first.reason.includes(held.prerequisite.requiredAction),
      'The terminal gate must name the required action',
    );
    await resumeGate(f, held.task.checkpoint);
  });
}

/** Reopen unchanged gates first, then observe a complete decision or real external artifact. */
async function resumeGate(f: ReviewedWorkflow, checkpoint: string) {
  await f.reopen();
  assert.equal(f.fixture.checkpoint(), checkpoint);
  const before = [...f.calls];
  const held = f.holds.at(-1)!;
  const receipts = f.fixture.task.observations<{ editReceipt?: unknown }>().filter((event) => event.editReceipt);
  assert.equal((await f.run()).kind, 'blocked');
  assert.deepEqual(f.calls, before, 'An unavailable prerequisite cannot reactivate dependent stewards');
  await f.reopen();
  assert.equal(f.fixture.checkpoint(), checkpoint);
  assert.deepEqual(f.fixture.task.history().findLast((event) => 'position' in event)!.position, held.position);
  assert.deepEqual(f.fixture.task.observations<{ editReceipt?: unknown }>().filter((event) => event.editReceipt), receipts);
  assert.equal(f.fixture.task.issue, held.task.issue);
  assert.equal(f.fixture.task.branch, held.task.branch);
  assert.equal(f.revisions.length, 0);
  assert.equal(f.reviews.length, 0);
  const start = f.gateEvents.length;
  // The preceding reopen still owns the writer; close it through the ordinary held run.
  assert.equal((await f.run()).kind, 'blocked');
  await f.reopen(true);
  const resumed = await f.run({
    progress() {},
    answer: async (question) => {
      assert.equal(question, gateQuestion);
      return gateAnswer;
    },
  });
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.equal(f.reviews.length, 1);
  if (f.scenario === 'external') {
    const events = f.gateEvents.slice(start);
    assert(events.indexOf('prerequisite-available') >= 0);
    assert(events.indexOf('prerequisite-available') < events.indexOf('steward'), 'Host prerequisite satisfaction must precede dependent activation');
  }
  if (f.scenario === 'human') {
    const answered = f.holds.flatMap((h) => h.answers).find((a) => a.question === gateQuestion);
    assert.equal(answered?.answer, gateAnswer);
  }
  assert(f.checkpoints.every((c) => c.owner === 'owner'));
}

/** Characterize the fixture's native decoder before relying on later unreachable recovery assertions. */
test('real Execution hold supplies a valid sequential native revision with unchanged completed prefix', async (t) => {
  const f = new ReviewedWorkflow(t, 'split');
  await f.prepare();
  const outcome = await f.fixture.run();
  assert.equal(outcome.kind, 'blocked');
  assert('holdContext' in outcome && outcome.holdContext);
  const held = outcome.holdContext as HoldContext;
  f.holds.push(held);
  const task = f.fixture.task;
  const plan = task.history().findLast((event) => 'plan' in event)!.plan!;
  const feedback = holdFeedback(held);
  const revision = (await f.services.direction.revise(
    task,
    plan,
    feedback,
    new AbortController().signal,
  )) as { kind: string; plan: Plan };
  assert.equal(revision.kind, 'plan');
  assert.deepEqual(revision.plan.milestones.slice(0, 2), plan.milestones.slice(0, 2));
  assert.deepEqual(
    revision.plan.milestones.slice(2).map((m) => m.id),
    ['part-a', 'part-b', correction.id],
  );
  assert.deepEqual(revision.plan.milestones[2]!.criteria, correction.criteria);
  assert.equal((f.revisions[0] as RevisionRequest).position.completed, 2);
});

/** Use the existing explicit correction feedback shape with actual host exit and evidence. */
function holdFeedback(held: HoldContext) {
  const observed = held.failure.check!;
  return {
    kind: 'supplier' as const,
    owner: 'owner',
    milestone: correction.id,
    requester: correction.id,
    reason: held.failure.diagnostic,
    evidence: [observed.log],
    failedCheck: {
      id: observed.id,
      activity: 'implementation' as const,
      expected: 'pass' as const,
      status: Number(observed.status),
      log: observed.log,
      diagnostic: held.failure.diagnostic,
    },
  };
}

test('interruption after a secured split contribution reuses it before the successor and original review', async (t) => {
  const f = new ReviewedWorkflow(t, 'split');
  await f.prepare();
  const stopped = await f.run(interruptFirstContribution());
  assert.equal(
    stopped.kind,
    'failed',
    'The planned interruption must reach its real checkpoint boundary',
  );
  assert.deepEqual(f.calls, [correction.id, 'Direction', 'part-a']);
  const task = f.holds[0]!.task;
  await f.reopen();
  assert.equal(f.fixture.task.taskID, task.id);
  assert.equal(f.fixture.task.issue, task.issue);
  assert.equal(f.fixture.task.branch, task.branch);
  assert.equal(f.fixture.task.readFile('fixture.txt').text, 'partial-a');
  const resumed = await f.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.deepEqual(f.calls, [
    correction.id,
    'Direction',
    'part-a',
    'part-b',
    correction.id,
    'Review',
    'Delivery',
  ]);
});

/** Interrupt only after the real journal commits the successful contribution activation. */
function interruptFirstContribution(): TaskObserver {
  return {
    progress() {},
    event(event) {
      const observation = event.observation as { activation?: { milestone: string } };
      if (observation.activation?.milestone === 'part-a')
        throw new Error('Interrupt after the first contribution was retained');
    },
  };
}
