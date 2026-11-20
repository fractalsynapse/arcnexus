import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { ActivityOutcome } from '../../../workflow/src/index.js';
import type { HoldContext } from '../../src/index.js';
import {
  answer,
  correction,
  question,
  ReviewedHoldFixture,
  selection,
} from '../fixtures/reviewed-hold.js';
import { Clarifications } from '../../src/index.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * hold-context-complete: Workflow consumes the actual steward outcome. Exact
 * rejection, acceptance, command, receipt, checkpoint and full answer assertions
 * reject current-attempt-only history, swapped logs and a generic blocked string.
 * hold-progress-grounded: compare repeated observations after incidental writes
 * and relevant checked changes; distinguish command prose from runCheck's typed
 * dependency prerequisite observation through a controlled preparation collaborator.
 * Constant identities, artifact-derived progress and model-claimed prerequisites
 * cannot satisfy these assertions. Workflow routing and independent re-review
 * belong to assembled integration; this controlled seam proves neither.
 *
 */
/** Require structured host evidence rather than interpreting the model's summary as recovery authority. */
function context(outcome: ActivityOutcome): HoldContext {
  assert.equal(outcome.kind, 'blocked', JSON.stringify(outcome));
  assert(
    'holdContext' in outcome && outcome.holdContext,
    'Execution hold must expose host-attested holdContext, not only a reason and artifact paths',
  );
  return outcome.holdContext as HoldContext;
}

/** Check exact correlations, not generic status text or mere presence of an artifact. */
function assertContinuity(fixture: ReviewedHoldFixture, held: HoldContext) {
  const task = fixture.task;
  assert.deepEqual(held.task, {
    id: task.taskID,
    issue: '699',
    branch: '699-task',
    base: task.capture.source.revision,
    checkpoint: fixture.checkpoint(),
    authority: task.capture.source.revision,
  });
  assert.equal(held.milestone, correction.id);
  assert.equal(held.activity, 'implementation');
  assert.deepEqual(held.acceptance, correction.criteria);
  assert.deepEqual(held.rejection, fixture.rejection);
  assert.deepEqual(held.receipts, fixture.receipts);
  for (const finding of held.rejection.findings)
    for (const path of finding.evidence)
      assert(task.readFile(path).text.includes('Independent rejection'));
}

/** Reject partial answers, renamed references and history confined to the current in-memory attempt. */
function assertAnswer(fixture: ReviewedHoldFixture, held: HoldContext) {
  assert.equal(held.answers.length, 1);
  const retained = held.answers[0]!;
  assert.equal(retained.question, question);
  assert.equal(retained.answer, answer);
  assert(retained.evidence);
  assert.equal(JSON.parse(fixture.task.readFile(retained.evidence).text).answer, answer);
  assert.deepEqual(
    new Clarifications(fixture.task, selection, new AbortController().signal).answers({
      milestone: { id: correction.id },
      acceptance: correction.criteria,
    }),
    [{ question, answer }],
  );
}

test('a reviewed steward hold exposes exact check, receipt, answer and secured identity after continuation', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  const before = fixture.checks[0]!;
  const first = await fixture.run();
  assert.equal(first.kind, 'blocked');
  assert.equal(fixture.checks.at(-1)!.status, 37);
  assert.notEqual(fixture.checks.at(-1)!.log, before.log);
  const identity = fixture.task.taskID;
  const checkpoint = fixture.checkpoint();
  await fixture.restart();
  assert.equal(fixture.task.taskID, identity);
  assert.equal(fixture.checkpoint(), checkpoint);
  assert.equal(
    fixture.task.readFile(before.log).text,
    'Error: rejected criterion still fails\nRelevant input: original\n',
  );
  const held = context(await fixture.run());
  assertContinuity(fixture, held);
  assertAnswer(fixture, held);
  assert.equal(held.failure.operation, 'owner-tests');
  assert.equal(held.failure.expected, 'pass');
  assert.deepEqual(held.failure.check, fixture.checks.at(-1));
  assert.equal(held.failure.diagnostic, fixture.checks.at(-1)!.diagnostic);
  assert.equal(
    fixture.task.readFile(held.failure.check!.log).text,
    fixture.task.readFile(before.log).text,
  );
});

test('new logs, provider claims, duplicate answers and unrelated checked edits cannot manufacture progress', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  const first = await fixture.run();
  fixture.task.store('incidental.log', 'The model says the hold is repaired.');
  const gate = fixture.task
    .observations<{ clarification?: unknown }>()
    .findLast((event) => event.clarification);
  assert(gate);
  fixture.task.note(gate);
  await fixture.edit('unrelated.txt', 'unrelated later checkpoint');
  await fixture.run();
  const repeat = await fixture.run();
  assert.notEqual(fixture.checks[0]!.log, fixture.checks.at(-1)!.log);
  const initial = context(first);
  const held = context(repeat);
  assert.equal(held.progress.identity, initial.progress.identity);
  assert.deepEqual(held.progress.inputs, initial.progress.inputs);
  assert.deepEqual(held.answers, initial.answers);
  assert.equal(held.prerequisite?.satisfied ?? false, false);
  assertContinuity(fixture, held);
});

test('a relevant secured correction changes grounded progress while preserving the original finding', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  const first = await fixture.run();
  await fixture.edit('fixture.txt', 'partially corrected');
  const correctionOutcome = await fixture.run();
  assert.equal(correctionOutcome.kind, 'repair');
  const subsequent = await fixture.run();
  const initial = context(first);
  const held = context(subsequent);
  assert.notEqual(held.progress.identity, initial.progress.identity);
  assert.notDeepEqual(held.progress.inputs, initial.progress.inputs);
  assert(
    held.progress.inputs.some(
      ({ path, digest }) => path === 'fixture.txt' && digest === fixture.task.readFile(path).sha256,
    ),
  );
  assertContinuity(fixture, held);
  assert.equal(
    held.failure.diagnostic,
    'Error: rejected criterion still fails\nRelevant input: partially corrected',
  );
});

test('command stderr cannot promote an ordinary failure into prerequisite authority', async (t) => {
  const fixture = new ReviewedHoldFixture(t, true);
  await fixture.prepare();
  await fixture.run();
  const result = await fixture.run();
  const observed = fixture.checks.at(-1)!;
  assert.equal(observed.status, 43);
  assert.equal(
    fixture.task.readFile(observed.log).text,
    'External prerequisite unavailable: schema.txt\nRequired action: supply the approved schema.\n',
  );
  const held = context(result);
  assertContinuity(fixture, held);
  assert.deepEqual(held.failure.check, observed);
  assert.equal(observed.prerequisite, undefined);
  assert.equal(held.failure.diagnostic, observed.diagnostic);
  assert.equal(held.prerequisite, undefined);
  await fixture.restart();
  const resumed = context(await fixture.run());
  assert.equal(resumed.prerequisite, undefined);
  assert.deepEqual(resumed.rejection, held.rejection);
});

test('a host-observed dependency prerequisite retains its diagnostic and required action after restart', async (t) => {
  const fixture = new ReviewedHoldFixture(t, true);
  fixture.requireDependencies();
  await fixture.prepare();
  await fixture.run();
  const observed = fixture.checks.at(-1)!;
  assert.equal(observed.status, 43);
  assert.equal(observed.prerequisite, 'dependencies');
  assert.equal(
    observed.reason,
    `Dependency prerequisite failed; requested check owner-tests did not run. See ${observed.log}`,
  );
  const held = context(await fixture.run());
  assertContinuity(fixture, held);
  const latest = fixture.checks.at(-1)!;
  assert.deepEqual(held.failure.check, latest);
  assert.equal(held.failure.diagnostic, latest.diagnostic);
  assert.equal(held.prerequisite?.kind, 'dependencies');
  assert.equal(held.prerequisite.satisfied, false);
  assert.equal(held.prerequisite.requiredAction, latest.reason);
  assert(held.prerequisite.evidence.includes(latest.log));
  await fixture.restart();
  const resumed = context(await fixture.run());
  assert.equal(resumed.prerequisite?.kind, 'dependencies');
  assert.equal(resumed.prerequisite.satisfied, false);
  assert.equal(resumed.prerequisite.requiredAction, fixture.checks.at(-1)!.reason);
  assert.deepEqual(resumed.rejection, held.rejection);
});

test('an ownership hold retains its exact refusal and prior receipts without inventing a check exit', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  const observedChecks = fixture.checks.length;
  fixture.refuseForeignEdit();
  const result = await fixture.run();
  assert.equal(result.kind, 'blocked');
  assert.match(result.reason, /schema.txt/);
  assert.equal(fixture.checks.length, observedChecks);
  const held = context(result);
  assertContinuity(fixture, held);
  assert.equal(held.failure.operation, 'checked-edit');
  assert.equal(held.failure.diagnostic, result.reason);
  assert.equal(held.failure.check, undefined);
  assert.deepEqual(held.receipts, fixture.receipts);
  assert.equal(fixture.task.readFile('unrelated.txt').text, 'acknowledged before hold');
});

test('a checked edit restored to the same relevant bytes does not renew an unchanged hold', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  const initial = context(await fixture.run());
  await fixture.edit('fixture.txt', 'temporary correction');
  await fixture.edit('fixture.txt', 'original');
  const repeated = context(await fixture.run());
  assert.equal(repeated.progress.identity, initial.progress.identity);
  assert.deepEqual(repeated.progress.inputs, initial.progress.inputs);
  assert.equal(repeated.receipts.length, initial.receipts.length + 2);
  assertContinuity(fixture, repeated);
});

test('unrelated checked edits cannot renew the same reviewed checked-edit refusal', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  let calls = 0;
  t.mock.method(fixture.task, 'activate', async () => {
    calls++;
    await fixture.edit('unrelated.txt', `incidental edit ${calls}`);
    return {
      kind: 'completed',
      edits: calls === 3 ? [] : [{ path: 'schema.txt', expected: null, content: 'foreign' }],
      checks: [],
    };
  });
  const held = context(await fixture.run());
  assert.equal(calls, 2, 'An unchanged ownership refusal must stop before another automatic reply');
  assert.equal(held.failure.operation, 'checked-edit');
  assertContinuity(fixture, held);
});

/** Exercise the real durable human gate while controlling only provider invocation. */
function questionProvider(t: TestContext, fixture: ReviewedHoldFixture) {
  t.mock.method(fixture.task, 'activate', async () => {
    await new Clarifications(fixture.task, selection, new AbortController().signal).decide(
      { milestone: { id: correction.id }, acceptance: correction.criteria },
      'Which approved schema must this correction use?',
    );
    return { kind: 'completed', edits: [], checks: [] };
  });
}

test('a real unanswered human gate retains its action and resumes only with a recorded answer', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  fixture.task.ask = async () => undefined;
  questionProvider(t, fixture);
  const held = context(await fixture.run());
  assert.equal(held.prerequisite?.kind, 'human-decision');
  assert.equal(held.prerequisite.satisfied, false);
  assert.equal(held.prerequisite.requiredAction, 'Which approved schema must this correction use?');
  assertContinuity(fixture, held);
  await fixture.restart();
  questionProvider(t, fixture);
  const repeated = context(await fixture.run());
  assert.equal(repeated.progress.identity, held.progress.identity);
  assert.deepEqual(repeated.prerequisite, held.prerequisite);
  fixture.task.ask = async () =>
    'Use the architect-approved schema A.\n\nRetain original acceptance.';
  const answered = context(await fixture.run());
  assert.equal(answered.prerequisite, undefined);
  assert.notEqual(answered.progress.identity, held.progress.identity);
  const recorded = answered.answers.find((a) => a.question === held.prerequisite?.requiredAction);
  assert.equal(
    recorded?.answer,
    'Use the architect-approved schema A.\n\nRetain original acceptance.',
  );
  assert(recorded?.evidence);
  assert.equal(JSON.parse(fixture.task.readFile(recorded.evidence).text).answer, recorded.answer);
  assertContinuity(fixture, answered);
});
