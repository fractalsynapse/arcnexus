import assert from 'node:assert/strict';
import test from 'node:test';
import { Clarifications, type HoldContext } from '../../../execution/src/index.js';
import {
  answer,
  correction,
  question,
  selection,
} from '../../../execution/tests/fixtures/reviewed-hold.js';
import { ReviewedWorkflow } from '../fixtures/reviewed-hold.js';

export const suite = {
  owner: 'workflow',
  level: 'integration',
  tags: ['regression', 'recovery'],
} as const;

/**
 * reviewed-hold-progress-stop/continuity: completed relevant knowledge releases
 * a retained non-prerequisite hold with unchanged Git bytes and check observation.
 * Duplicate answers/reports and foreign inbox knowledge cannot release it.
 * Real SQLite/Git and public Workflow.run retain task, acceptance and evidence;
 * controlled completed research and independent assessment do not prove live inference.
 */
for (const kind of ['clarification', 'research'] as const) {
  test(`restart consumes new relevant ${kind} knowledge before fresh independent review`, async (t) => {
    const f = new ReviewedWorkflow(t, 'diagnostic');
    await f.prepare();
    assert.equal((await f.run()).kind, 'blocked');
    const held = f.holds.at(-1)!;
    const historical = JSON.stringify(f.holds);
    await duplicateAnswer(f, held);
    await f.reopen();
    assertContinuity(f, held);
    await completeKnowledge(f, kind);
    assertContinuity(f, held);
    assert.equal(f.reviews.length, 0, 'Knowledge alone cannot accept the task');
    const resumed = await f.run();
    assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
    assert.equal(f.revisions.length, 2, 'New relevant knowledge permits concrete correction');
    assert.equal(f.reviews.length, 1, 'Correction still requires fresh independent assessment');
    assert.notEqual(f.holds.at(-1)!.progress.identity, held.progress.identity);
    assert.equal(JSON.stringify(f.holds.slice(0, 2)), historical);
    assertCompletedKnowledge(f);
    assert.deepEqual(f.calls.slice(4), [
      correction.id,
      'Direction',
      'part-2',
      correction.id,
      'Review',
      'Delivery',
    ]);
  });
}

test('duplicate completed research with a new artifact remains stopped after reopening', async (t) => {
  const f = new ReviewedWorkflow(t, 'diagnostic');
  await f.prepare();
  await completeKnowledge(f, 'research');
  assert.equal((await f.run()).kind, 'blocked');
  const held = f.holds.at(-1)!;
  assert.equal(held.research.length, 1);
  await f.reopen();
  await completeKnowledge(f, 'research');
  const result = f.fixture.task
    .observations<{
      researchResult?: HoldContext['research'][number];
    }>()
    .findLast((event) => event.researchResult)!.researchResult!;
  assert.notEqual(result.evidence, held.research[0]!.evidence);
  assert.equal(result.digest, held.research[0]!.digest);
  assertContinuity(f, held);
  const calls = [...f.calls];
  assert.equal((await f.run()).kind, 'blocked');
  assert.deepEqual(f.calls, calls);
  assert.equal(f.reviews.length, 0);
});

/** Repeated completed knowledge and another caller's answer cannot manufacture progress. */
async function duplicateAnswer(f: ReviewedWorkflow, held: HoldContext) {
  await f.reopen();
  const task = f.fixture.task;
  const existing = held.answers.find((entry) => entry.question === question)!;
  task.note({
    clarification: {
      ...existing,
      evidence: task.store('duplicate-answer.json', JSON.stringify(existing)),
    },
  });
  task.note({
    clarification: {
      scope: task.inboxScope({ component: 'other', activity: 'implementation' }, context()),
      question: 'Foreign caller knowledge',
      answer: 'Complete but unrelated answer',
    },
  });
  assertContinuity(f, held);
  const calls = [...f.calls];
  assert.equal((await f.run()).kind, 'blocked');
  assert.deepEqual(f.calls, calls);
  assert.equal(f.reviews.length, 0);
}

/** Complete a real clarification or inject an explicit completed report at the retained inbox boundary. */
async function completeKnowledge(f: ReviewedWorkflow, kind: 'clarification' | 'research') {
  const task = f.fixture.task;
  if (kind === 'clarification') return completeClarification(f);
  const evidence = task.store(
    'completed-research.md',
    'Complete research: correct fixture.txt under schema A.\n',
  );
  task.note({
    researchResult: {
      request: {
        id: 'reviewed-knowledge',
        inbox: task.inboxScope(selection, context()),
        requestedBy: selection,
        question: 'Which correction preserves the rejected schema?',
        decision: 'Repair the original criterion without changing authority',
      },
      component: 'owner',
      evidence,
      digest: task.readFile(evidence).sha256,
    },
  });
}

/** Confirm each new answer/report reaches Execution intact alongside the original complete answer. */
function assertCompletedKnowledge(f: ReviewedWorkflow) {
  const current = f.holds.at(-1)!;
  assert.deepEqual(current.progress.inputs, f.holds[1]!.progress.inputs);
  assert.equal(current.failure.diagnostic, f.holds[1]!.failure.diagnostic);
  assert(current.answers.length > f.holds[1]!.answers.length || current.research.length > 0);
  assert.equal(current.answers.find((entry) => entry.question === question)?.answer, answer);
}

/** Assert unchanged secured state and check before knowledge can cause any correction. */
function assertContinuity(f: ReviewedWorkflow, held: HoldContext) {
  const task = f.fixture.task;
  assert.equal(task.taskID, held.task.id);
  assert.equal(task.issue, held.task.issue);
  assert.equal(task.branch, held.task.branch);
  assert.equal(f.fixture.checkpoint(), held.task.checkpoint);
  for (const input of held.progress.inputs)
    assert.equal(task.readFile(input.path).sha256, input.digest);
  const latest = task
    .observations<{ check?: { log: string } }>()
    .findLast((event) => event.check)?.check;
  assert.equal(latest?.log, held.failure.check!.log, 'No new check may release this restart');
  const events = task.history();
  const plan = events.findLast((event) => 'plan' in event)!.plan!;
  assert.deepEqual(plan.milestones.find((m) => m.id === correction.id)!.criteria, held.acceptance);
  assert.deepEqual(events.findLast((event) => 'position' in event)!.position, held.position);
  assert.deepEqual(held.rejection, f.holds[0]!.rejection);
  for (const receipt of held.receipts)
    assert(
      task
        .observations<{ editReceipt?: { id: string } }>()
        .some((e) => e.editReceipt?.id === receipt.id),
    );
}

/** Select the same public retained caller scope used for the original complete answer. */
function context() {
  return { milestone: { id: correction.id }, acceptance: correction.criteria };
}

/** Use the real conversation loop to complete a distinct question in an already answered inbox. */
async function completeClarification(f: ReviewedWorkflow) {
  const task = f.fixture.task;
  const signal = new AbortController().signal;
  task.ask = async () =>
    '  Preserve schema A.\n\nCorrect the reviewed input using the complete answer.  ';
  const gates = new Clarifications(task, selection, signal);
  const question = 'How should correction proceed?';
  await gates.run(context(), async () =>
    gates.answers(context()).some((gate) => gate.question === question)
      ? { kind: 'completed', edits: [], checks: [] }
      : { kind: 'question', question },
  );
}
