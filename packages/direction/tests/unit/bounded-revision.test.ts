import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activities,
  decodeDirectorResponse,
  validateRevision,
  type Milestone,
  type Plan,
} from '../../src/index.js';

const focus = { purpose: 'Improve the project', objectives: ['Deliver'], constraints: ['Keep authority'] };

/** Provide an accepted milestone with individually identifiable outcomes. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'direction',
    criteria: [{ id: `criterion-${id}`, description: `Accepted outcome ${id}` }],
    steps: activities.map((activity) => ({
      activity,
      checklist: [{ id: `${id}-${activity}`, criteria: [`criterion-${id}`], expected: activity }],
    })),
  };
}

test('initial planning still decodes a complete plan and diagnoses malformed Focus', () => {
  const plan: Plan = { focus, milestones: [milestone('initial')] };
  assert.deepEqual(decodeDirectorResponse({ kind: 'plan', plan }), { kind: 'plan', plan });
  assert.throws(
    () => decodeDirectorResponse({ kind: 'plan', plan: { ...plan, focus: null } }),
    /plan.focus/,
  );
});

test('a revision response can contain pending milestones without reproducing completed work', () => {
  const pending = [milestone('pending')];
  const response = { kind: 'plan', plan: { milestones: pending } };
  assert.deepEqual(decodeDirectorResponse(response), response);
});

test('revision validation preserves acceptance from a large completed prefix', () => {
  const completed = Array.from({ length: 200 }, (_, index) => milestone(`done-${index}`));
  const before: Plan = { focus, milestones: [...completed, milestone('pending')] };
  const after = structuredClone(before);
  after.milestones[0]!.criteria[0]!.description = 'Changed accepted outcome';
  assert.throws(() => validateRevision(before, after, completed.length, new Map()), /completed|acceptance/);
  assert.equal(before.milestones[0]!.criteria[0]!.description, 'Accepted outcome done-0');
});

test('revision validation rejects changes to completed Steps in a pending milestone', () => {
  const before: Plan = { focus, milestones: [milestone('pending')] };
  const after = structuredClone(before);
  after.milestones[0]!.steps[0]!.checklist[0]!.expected = 'Changed completed outcome';
  assert.throws(() => validateRevision(before, after, 0, new Map([['pending', 1]])), /completed Steps/);
});
