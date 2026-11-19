import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import * as direction from '../../src/index.js';
import type { Milestone, Plan, RevisionFeedback } from '../../src/index.js';

const focus = { purpose: 'Deliver', objectives: ['Improve'], constraints: ['Preserve authority'] };
const profile = { role: 'steward', profile: 'steward', instructions: [], operations: [], standards: [] };
const components = Object.fromEntries(['direction', 'supplier'].map((id) => [id, {
  id, purpose: id, owns: [id], activities: Object.fromEntries(
    direction.activities.slice(0, 4).map((activity) => [activity, profile]),
  ),
}]));
const capture = { components } as unknown as Capture;

interface Request {
  acceptedPlan: string;
  retainedEvidence: string;
  position: { completed: number; activities: Readonly<Record<string, number>> };
  finding: RevisionFeedback;
}

const decode = (direction as unknown as {
  decodeRevisionResponse: (
    response: unknown, capture: Capture, accepted: Plan, request: Request,
  ) => { kind: 'plan'; plan: Plan };
}).decodeRevisionResponse;

/** Build identifiable accepted outcomes and Steps for revision fixtures. */
function milestone(id: string, owner = 'direction'): Milestone {
  const criterion = { id: `criterion-${id}`, description: `Accepted ${id}` };
  return {
    id, owner, criteria: [criterion],
    steps: direction.activities.map((activity) => ({
      activity, checklist: [{ id: `${id}-${activity}`, criteria: [criterion.id], expected: activity }],
    })),
  };
}

/** Supply immutable artifact references and the host's committed position. */
function request(completed: number, finding: RevisionFeedback, activities: Record<string, number> = {}): Request {
  return { acceptedPlan: '/evidence/accepted.json', retainedEvidence: '/evidence/all.json',
    position: { completed, activities }, finding };
}

const finding: RevisionFeedback = {
  kind: 'supplier', milestone: 'supplier', requester: 'requester', owner: 'supplier',
  reason: 'Need the supplier', question: 'What is the boundary?', evidence: ['/evidence/failure.log'],
};

/** Wrap only the proposed pending milestones in the native wire shape. */
function proposal(milestones: readonly Milestone[]) {
  return { kind: 'plan', plan: { milestones } };
}

test('reconstructs a supplier before a partially completed requester after a large prefix', () => {
  const prefix = Array.from({ length: 200 }, (_, index) => milestone(`done-${index}`));
  const original = milestone('requester');
  const accepted: Plan = { focus, milestones: [...prefix, original] };
  const pending = { ...original, steps: original.steps.slice(2) };
  const supplier = milestone('supplier', 'supplier');
  const input = request(200, finding, { requester: 2 });
  const before = structuredClone({ accepted, input });
  const result = decode(proposal([supplier, pending]), capture, accepted, input);
  assert.deepEqual(result.plan, { focus, milestones: [...prefix, supplier, original] });
  assert.deepEqual({ accepted, input }, before);
});

test('rejects an attempted change to completed acceptance with a repair diagnostic', () => {
  const done = milestone('done');
  const accepted: Plan = { focus, milestones: [done, milestone('requester')] };
  const changed = { ...done, criteria: [{ ...done.criteria[0]!, description: 'Changed' }] };
  const input = request(1, finding);
  const before = structuredClone(accepted);
  assert.throws(() => decode(proposal([changed, accepted.milestones[1]!]), capture, accepted, input),
    /done|completed|acceptance/i);
  assert.deepEqual(accepted, before);
});

test('rejects malformed pending fields with their exact path for same-activity repair', () => {
  const accepted: Plan = { focus, milestones: [milestone('requester')] };
  const malformed = proposal([{ ...accepted.milestones[0]!, owner: 42 } as unknown as Milestone]);
  assert.throws(() => decode(malformed, capture, accepted, request(0, finding)),
    { message: 'plan.milestones[0].owner: expected string, received number' });
});

test('reuses a completed supplier while retaining a partially completed requester', () => {
  const supplier = milestone('supplier', 'supplier');
  const original = milestone('requester');
  const accepted: Plan = { focus, milestones: [supplier, original] };
  const pending = { ...original, steps: original.steps.slice(1) };
  const result = decode(proposal([pending]), capture, accepted, request(1, finding, { requester: 1 }));
  assert.deepEqual(result.plan, accepted);
});

test('rejects removal or alteration of pending accepted obligations', () => {
  const original = milestone('requester');
  const accepted: Plan = { focus, milestones: [original] };
  const input = request(0, finding);
  const cases = [
    proposal([]),
    proposal([{ ...original, owner: 'supplier' }]),
    proposal([{ ...original, criteria: [{ ...original.criteria[0]!, description: 'Changed' }] }]),
    proposal([{ ...original, steps: original.steps.slice(1) }]),
    { kind: 'plan', plan: { focus, milestones: [original] } },
  ];
  for (const response of cases) {
    assert.throws(() => decode(response, capture, accepted, input));
    assert.deepEqual(accepted, { focus, milestones: [original] });
  }
});

test('retains all completed work when final rejection adds correction work', () => {
  const original = milestone('original');
  const accepted: Plan = { focus, milestones: [original] };
  const correction = { ...milestone('correction'), criteria: original.criteria,
    steps: milestone('correction').steps.map((step) => ({
      ...step, checklist: step.checklist.map((item) => ({ ...item, criteria: [original.criteria[0]!.id] })),
    })) };
  const rejection: RevisionFeedback = { kind: 'rejection', findings: [{
    criterion: original.criteria[0]!.id, owner: original.owner,
    reason: 'Rejected', evidence: ['/evidence/review.json'],
  }] };
  const result = decode(proposal([correction]), capture, accepted, request(1, rejection));
  assert.deepEqual(result.plan, { focus, milestones: [original, correction] });
});
