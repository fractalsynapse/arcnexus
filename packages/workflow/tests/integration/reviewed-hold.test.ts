import assert from 'node:assert/strict';
import test from 'node:test';
import { correction } from '../../../execution/tests/fixtures/reviewed-hold.js';
import { gateAnswer, gateQuestion, ReviewedWorkflow } from '../fixtures/reviewed-hold.js';

export const suite = {
  owner: 'workflow',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * Workflow.run consumes real Execution holds after retained independent rejection.
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
});

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
    'Direction',
    'part-2',
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
    const checkpoint = held.task.checkpoint;
    await f.reopen();
    assert.equal(f.fixture.checkpoint(), checkpoint);
    assert.equal((await f.run()).kind, 'blocked');
    assert.equal(f.revisions.length, 0);
    assert.equal(f.reviews.length, 0);
    await f.reopen(true);
    assert.equal(
      (await f.run()).kind,
      'merged',
      'Observed satisfaction resumes the retained correction',
    );
    assert.equal(f.reviews.length, 1);
    if (scenario === 'human') {
      const answered = f.holds.flatMap((h) => h.answers).find((a) => a.question === gateQuestion);
      assert.equal(answered?.answer, gateAnswer);
    }
    assert(f.checkpoints.every((c) => c.owner === 'owner'));
  });
}
