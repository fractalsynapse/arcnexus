import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import type { ActivityOutcome } from '../../../workflow/src/index.js';
import {
  ForeignHandoffScenario,
  answer,
  diagnostic,
  plan,
  question,
  requester,
  supplier,
} from '../fixtures/foreign-handoff.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const approvedCorrection =
  'Read failedCheck.log first. It is the latest observed failure. Preserve the earlier finding and acknowledged edits. Correct an owned defect through this activity. If a required check needs unfinished work from another owner, use request-supplier before returning completed. Link the existing accepted milestone with its actual owner and criteria when it covers that work; already accepted pending work still requires explicit sequencing. Describe distinct new work only when no accepted milestone covers it. Listing foreign failures in summary or answer does not request their contribution. After the supplier result, refresh affected checks; the host preserves the original expectation and required completion verification.';

test('the actual steward correction request explicitly sequences accepted unfinished foreign work', async (t) => {
  const scenario = new ForeignHandoffScenario(t);
  assert.equal((await scenario.run()).kind, 'repair');
  scenario.mode = 'acknowledge';
  await scenario.run();
  const assignment = renderedAssignment(scenario);
  assert(
    scenario.requests.at(-1)!.request.options.tools.some(({ name }) => name === 'request-supplier'),
  );
  assert.equal(assignment.correction, approvedCorrection);
  const guidance = String(assignment.instructions) + String(assignment.repair);
  assert.match(guidance, /request-supplier before returning completed/);
  assert.match(guidance, /accepted.*milestone.*owner.*criteria/);
  assert.match(guidance, /accepted pending work.*explicit sequencing/);
  assert.match(guidance, /distinct new work.*no accepted milestone/);
});

test('accepted foreign handoff retains the owned checkpoint and consumes the complete supplier result', async (t) => {
  const scenario = new ForeignHandoffScenario(t);
  assert.equal((await scenario.run()).kind, 'repair');
  scenario.mode = 'handoff';
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'supplier');
  assert(outcome.kind === 'supplier');
  assert.equal(outcome.owner, supplier.owner);
  assert.equal(outcome.milestone, supplier.id);
  assert.equal(outcome.reason, `Required repository-types needs ${supplier.criteria[0]!.id}`);
  assert.equal(outcome.question, question);
  assert.deepEqual(scenario.task.history().findLast((event) => 'plan' in event)?.plan, plan);
  scenario.assertRetained();
  scenario.task.record({
    activation: {
      milestone: requester.id,
      owner: requester.owner,
      step: 'implementation',
      index: 2,
      outcome,
    },
  });
  const evidence = await scenario.supply();
  scenario.mode = 'resume';
  assert.equal((await scenario.run()).kind, 'completed');
  assertSupplierReturn(scenario, evidence);
  scenario.assertRetained();
});

test('acknowledging unresolved foreign failure cannot complete or bypass the unchanged-failure hold', async (t) => {
  const scenario = new ForeignHandoffScenario(t);
  const first = await scenario.run();
  assert.equal(first.kind, 'repair');
  assert(first.kind === 'repair');
  assertOriginalFailure(scenario, first);
  scenario.mode = 'acknowledge';
  const held = await scenario.run();
  assert.equal(held.kind, 'blocked');
  assert(held.kind === 'blocked');
  assert.equal(held.reason, 'Operation repository-types exited 23; expected pass');
  assert.equal(held.failedCheck?.expected, 'pass');
  assert.equal(held.failedCheck?.status, 23);
  assert.equal(readFileSync(held.failedCheck!.log, 'utf8'), diagnostic);
  assert.equal(readFileSync(first.failedCheck!.log, 'utf8'), diagnostic);
  assert(held.evidence.includes(first.failedCheck!.log));
  assert(
    !scenario.task
      .history()
      .some(
        (event) =>
          'activation' in event &&
          event.activation.milestone === requester.id &&
          event.activation.outcome.kind === 'completed',
      ),
  );
  assert(!scenario.task.observations<any>().some(({ projectRequest }) => projectRequest));
  scenario.assertRetained();
});

/** Compare the complete child return and ordered affected rechecks, rejecting shallow acknowledgment. */
function assertSupplierReturn(scenario: ForeignHandoffScenario, evidence: string[]) {
  const assignment = scenario.contexts.at(-1)!.assignment as Record<string, unknown>;
  assert.deepEqual(assignment.supplierAnswers, [
    {
      supplier: supplier.id,
      question,
      replies: [{ step: 'implementation', answer, evidence }],
    },
  ]);
  assert.equal(readFileSync(evidence[0]!, 'utf8'), answer);
  assert.deepEqual(
    scenario.checks.map(({ id, status }) => [id, status]),
    [
      ['repository-types', 23],
      ['repository-types', 0],
      ['repository-types', 0],
    ],
  );
}

/** Preserve the original expected pass and exact failing observation through caller correction. */
function assertOriginalFailure(scenario: ForeignHandoffScenario, first: ActivityOutcome) {
  assert(first.kind === 'repair');
  assert.deepEqual(first.failedCheck, {
    id: 'repository-types',
    expected: 'pass',
    status: 23,
    log: scenario.checks[0]!.log,
    activity: 'implementation',
  });
}

/** Read the actual serialized Task section, catching request assembly that drops caller guidance. */
function renderedAssignment(scenario: ForeignHandoffScenario): Record<string, unknown> {
  const input = scenario.requests.at(-1)!.request.input;
  const task = input.slice(input.indexOf('Goal:'), input.indexOf('\n\n## Activity'));
  return (parse(task) as { assignment: Record<string, unknown> }).assignment;
}
