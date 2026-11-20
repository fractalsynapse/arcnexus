import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActivityOutcome } from '../../../workflow/src/index.js';
import type { CheckResult } from '../../src/check.js';
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
 * Expected observable projection at the Execution/Workflow boundary.
 * Keep this test-local until Implementation adds the public recovery type.
 */
interface HoldContext {
  task: {
    id: string;
    issue: string;
    branch: string;
    base: string;
    checkpoint: string;
    authority: string;
  };
  milestone: string;
  activity: string;
  acceptance: typeof correction.criteria;
  rejection: ReviewedHoldFixture['rejection'];
  failure: { diagnostic: string; operation: string; expected?: string; check?: CheckResult };
  receipts: readonly unknown[];
  answers: readonly { question: string; answer: string; evidence: string }[];
  progress: { identity: string; inputs: readonly { path: string; digest: string }[] };
  prerequisite?: {
    kind: string;
    satisfied: boolean;
    requiredAction: string;
    evidence: readonly string[];
  };
}

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

test('an actual unavailable input stays an unsatisfied prerequisite despite optimistic model claims', async (t) => {
  const fixture = new ReviewedHoldFixture(t);
  await fixture.prepare();
  fixture.requireExternal();
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
  assert.equal(held.prerequisite?.kind, 'external');
  assert.equal(held.prerequisite.satisfied, false);
  assert.equal(held.prerequisite.requiredAction, 'Supply the approved schema.');
  assert(held.prerequisite.evidence.includes(observed.log));
  await fixture.restart();
  const resumed = context(await fixture.run());
  assert.equal(resumed.prerequisite?.satisfied, false);
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
