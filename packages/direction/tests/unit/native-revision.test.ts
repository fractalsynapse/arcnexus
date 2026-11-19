import assert from 'node:assert/strict';
import test from 'node:test';
import { HostTask } from '../../../execution/src/index.js';
import { direct, type Plan, type RevisionRequest } from '../../src/index.js';

const plan: Plan = {
  focus: { purpose: 'Goal', objectives: ['Outcome'], constraints: ['Preserve authority'] },
  milestones: [{
    id: 'requester', owner: 'direction', criteria: [{ id: 'c1', description: 'Accepted' }],
    steps: ['documentation', 'testing', 'implementation', 'review', 'release'].map((activity) => ({
      activity: activity as 'documentation', checklist: [{ id: activity, criteria: ['c1'], expected: activity }],
    })),
  }],
};

/** Capture the exact activation passed through Direction's native entry point. */
function nativeSession() {
  const session = Object.create(HostTask.prototype) as HostTask;
  let activation: Record<string, unknown> | undefined;
  Object.assign(session, {
    capture: { project: { director: { component: 'director', activity: 'planning' } } },
    evidence: [],
    activate: (_agent: unknown, _selection: unknown, data: Record<string, unknown>) => {
      activation = data;
      return Promise.resolve({ kind: 'plan', plan });
    },
  });
  return { session, activation: () => { assert(activation); return activation; } };
}

test('native initial repair retains the complete-plan response boundary', async () => {
  const host = nativeSession();
  const feedback = { kind: 'plan-repair' as const, diagnostic: 'Invalid complete plan' };
  await direct({} as never, host.session, new AbortController().signal, { feedback });
  const data = host.activation();
  const assignment = data.assignment as Record<string, unknown>;
  assert.deepEqual(assignment.plan, {
    kind: 'plan',
    plan: {
      focus: { purpose: 'string', objectives: ['string'], constraints: ['string'] },
      milestones: [{
        id: 'stable id', owner: 'component id', criteria: [{ id: 'stable id',
          description: 'engineering evidence available before independent review and delivery' }],
        steps: [{ activity: 'documentation, testing, implementation, review, release (in order)',
          checklist: [{ id: 'stable id', criteria: ['criterion id'], expected: 'observable result' }] }],
      }],
    },
  });
  assert.equal((assignment.feedback as typeof feedback).diagnostic, feedback.diagnostic);
});

test('native revision repair exposes only pending plan shape and committed Step suffix cursor', async () => {
  const host = nativeSession();
  const revision: RevisionRequest = {
    acceptedPlan: '/evidence/accepted.json', retainedEvidence: '/evidence/all.json',
    position: { completed: 120, activities: { requester: 2 } },
    finding: { kind: 'supplier', milestone: 'supplier', requester: 'requester', owner: 'supplier',
      reason: 'Need supplier work', evidence: ['/evidence/failure.log'] },
  };
  const feedback = { kind: 'plan-repair' as const, diagnostic: 'Invalid pending suffix',
    original: revision.finding };
  await direct({} as never, host.session, new AbortController().signal, { revision, feedback });
  const data = host.activation();
  const assignment = data.assignment as Record<string, unknown>;
  assert.deepEqual(assignment.plan, { kind: 'plan', plan: { milestones: [] } });
  assert.deepEqual(assignment.revisionContext, {
    acceptedPlan: revision.acceptedPlan, retainedEvidence: revision.retainedEvidence,
    position: { completed: 120, activities: { requester: 2 } }, finding: revision.finding,
  });
  assert.match(String(assignment.revision), /only the necessary pending sequence/);
  assert.match(String(assignment.revision), /after the committed activity position/);
  assert.deepEqual(assignment.feedback, feedback);
});
