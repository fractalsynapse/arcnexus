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

test('revision validation preserves acceptance from a large completed prefix', () => {
  const completed = Array.from({ length: 200 }, (_, index) => milestone(`done-${index}`));
  const before: Plan = { focus, milestones: [...completed, milestone('pending')] };
  const first = before.milestones[0]!;
  const after: Plan = {
    ...before,
    milestones: [
      { ...first, criteria: [{ ...first.criteria[0]!, description: 'Changed accepted outcome' }] },
      ...before.milestones.slice(1),
    ],
  };
  assert.throws(() => validateRevision(before, after, completed.length, new Map()), /completed|acceptance/);
  assert.equal(before.milestones[0]!.criteria[0]!.description, 'Accepted outcome done-0');
});

test('revision validation rejects changes to completed Steps in a pending milestone', () => {
  const before: Plan = { focus, milestones: [milestone('pending')] };
  const first = before.milestones[0]!;
  const step = first.steps[0]!;
  const after: Plan = {
    ...before,
    milestones: [{
      ...first,
      steps: [
        { ...step, checklist: [{ ...step.checklist[0]!, expected: 'Changed completed outcome' }] },
        ...first.steps.slice(1),
      ],
    }],
  };
  assert.throws(() => validateRevision(before, after, 0, new Map([['pending', 1]])), /completed Steps/);
});
