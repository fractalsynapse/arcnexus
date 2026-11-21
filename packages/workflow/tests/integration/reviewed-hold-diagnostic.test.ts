import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { HoldContext } from '../../../execution/src/index.js';
import { git } from '../../../execution/src/git.js';
import { correction } from '../../../execution/tests/fixtures/reviewed-hold.js';
import { ReviewedWorkflow } from '../fixtures/reviewed-hold.js';

export const suite = {
  owner: 'workflow',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * reviewed-hold-progress-stop/continuity/correction: a scoped actual recheck can
 * expose a distinct finding with identical secured source. Workflow.run must
 * consume that observation through Execution before native Direction correction.
 * An equivalent recheck with a new log must not renew an automatic attempt.
 * Real Git/SQLite retains identity, answers, rejection, receipts and acceptance;
 * Production HostTask.check runs with a controlled confinement launcher and leaves ordinary
 * failure diagnostics in its complete log, without synthesizing a diagnostic field.
 * Controlled command inputs and review do not establish live inference.
 */
test('restart consumes a distinct failing recheck without changed secured bytes', async (t) => {
  const f = new ReviewedWorkflow(t, 'diagnostic', true);
  await f.prepare();
  assert.equal((await f.run()).kind, 'blocked');
  const held = f.holds.at(-1)!;
  const original = JSON.stringify(f.holds);
  assert.deepEqual(f.calls, [correction.id, 'Direction', 'part-1', correction.id]);
  assert.equal(f.holds[0]!.progress.identity, held.progress.identity);
  await equivalentRecheck(f, held);
  await f.reopen();
  assertContinuity(f, held);
  f.diagnostic = 'Error: distinct reviewed assertion B fails\nPreserve the schema decision.';
  const checked = await f.recheck();
  assert.equal(checked.status, 37, f.fixture.task.readFile(checked.log).text);
  assert.equal(checked.diagnostic, undefined, 'Ordinary production failures carry status and log');
  assert(f.fixture.task.readFile(checked.log).text.includes(f.diagnostic));
  assert.equal(
    f.fixture.task.pendingCheck({ owner: 'owner', activity: 'implementation' })?.diagnostic,
    undefined,
  );
  assert.notEqual(checked.log, held.failure.check!.log);
  assertContinuity(f, held);
  const resumed = await f.run();
  assert.equal(f.revisions.length, 2, 'A distinct actual diagnostic must reach Direction');
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assertNewFinding(f, held, checked.log);
  assert.equal(JSON.stringify(f.holds.slice(0, 2)), original);
});

/** Reopen and recheck the same bytes; a new artifact alone must leave the task stopped. */
async function equivalentRecheck(f: ReviewedWorkflow, held: HoldContext) {
  await f.reopen();
  assertContinuity(f, held);
  const checked = await f.recheck();
  assert.equal(checked.status, 37, f.fixture.task.readFile(checked.log).text);
  assert.equal(checked.diagnostic, undefined);
  assert.notEqual(checked.log, held.failure.check!.log);
  assert.equal(
    f.fixture.task.readFile(checked.log).text,
    f.fixture.task.readFile(held.failure.check!.log).text,
  );
  assertContinuity(f, held);
  const before = [...f.calls];
  const stopped = await f.run();
  assert.equal(stopped.kind, 'blocked');
  assert.deepEqual(f.calls, before, 'Equivalent recheck must not permit another correction');
  assert.equal(f.revisions.length, 1);
  assert.equal(f.reviews.length, 0);
  assert('reason' in stopped);
  assert(stopped.reason.includes('original-criterion'));
  assert(stopped.reason.includes(held.failure.diagnostic));
}

/** Compare actual reconstructed source, task identity and accepted work before any new edit. */
function assertContinuity(f: ReviewedWorkflow, held: HoldContext) {
  const task = f.fixture.task;
  assert.equal(task.taskID, held.task.id);
  assert.equal(task.issue, held.task.issue);
  assert.equal(task.branch, held.task.branch);
  assert.equal(f.fixture.checkpoint(), held.task.checkpoint);
  assert.equal(git(task.worktree!, 'status', '--porcelain'), '');
  assertRetainedKnowledge(f, held);
  for (const input of held.progress.inputs)
    assert.equal(task.readFile(input.path).sha256, input.digest);
  const events = task.history();
  const plan = events.findLast((event) => 'plan' in event)!.plan!;
  assert.deepEqual(plan.milestones.find((m) => m.id === correction.id)!.criteria, held.acceptance);
  assert.deepEqual(events.findLast((event) => 'position' in event)!.position, held.position);
  assert(events.some((event) => 'verdict' in event && event.verdict.kind === 'rejected'));
  for (const finding of held.rejection.findings)
    for (const evidence of finding.evidence)
      assert(task.readFile(evidence).text.includes('Independent rejection'));
}

/** Require complete original answers and identical acknowledged receipts after reopening SQLite. */
function assertRetainedKnowledge(f: ReviewedWorkflow, held: HoldContext) {
  const events = f.fixture.task.observations<{
    clarification?: HoldContext['answers'][number];
    editReceipt?: HoldContext['receipts'][number];
    checkpoint?: { head: string };
  }>();
  for (const answer of held.answers)
    assert(events.some((event) => JSON.stringify(event.clarification) === JSON.stringify(answer)));
  for (const receipt of held.receipts)
    assert(events.some((event) => JSON.stringify(event.editReceipt) === JSON.stringify(receipt)));
  for (const secured of held.receiptCheckpoints)
    assert(
      events.some(
        (event) =>
          event.editReceipt?.id === secured.receipt &&
          event.checkpoint?.head === secured.checkpoint,
      ),
    );
}

/** Require the new exact failure at native revision and preserve full historical context. */
function assertNewFinding(f: ReviewedWorkflow, held: HoldContext, log: string) {
  const current = f.holds.at(-1)!;
  assert.equal(current.failure.diagnostic, 'Operation owner-tests exited 37; expected pass');
  assert.equal(current.failure.check!.status, 37);
  assert(f.fixture.checks.some((check) => check.log === log));
  const actual = f.fixture.checks.find((check) => check.log === current.failure.check!.log)!;
  assert.equal(actual.diagnostic, undefined);
  assert.equal(actual.status, 37);
  assert.equal(readFileSync(actual.log, 'utf8'), f.diagnostic + '\n');
  assert.equal(readFileSync(log, 'utf8'), f.diagnostic + '\n');
  assert.notEqual(current.progress.identity, held.progress.identity);
  assert.deepEqual(current.progress.inputs, held.progress.inputs);
  assert.deepEqual(current.task, held.task);
  assert.deepEqual(current.answers, held.answers);
  assert.deepEqual(current.rejection, held.rejection);
  assert.deepEqual(current.acceptance, held.acceptance);
  assert.deepEqual(current.receipts, held.receipts);
  assert.deepEqual(f.calls.slice(4), [
    correction.id,
    'Direction',
    'part-2',
    correction.id,
    'Review',
    'Delivery',
  ]);
  assert.equal(f.reviews.length, 1, 'The corrected candidate requires fresh independent review');
}
