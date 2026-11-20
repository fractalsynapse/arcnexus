import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { validateVerdict } from '../../../verification/src/index.js';
import { activities, validatePlan, type Plan } from '../../src/index.js';

export const suite = { owner: 'direction', level: 'unit', tags: ['regression'] } as const;

const capture: Capture = {
  source: { root: '.', revision: 'base', remote: '', paths: [], read: () => '' },
  project: {
    id: 'fixture',
    remote: '',
    contractRegistry: '',
    planTemplate: '',
    director: { component: 'docs', activity: 'planning' },
    verifier: { component: 'docs', activity: 'assessment' },
  },
  components: {
    docs: {
      id: 'docs',
      purpose: 'Maintain the guide',
      owns: ['guide.md'],
      activities: {
        documentation: {
          role: 'writer',
          profile: 'profile',
          instructions: [],
          operations: [],
          standards: [],
        },
      },
    },
  },
  contracts: [],
  roles: {},
  profiles: {},
  operations: {},
  standards: {},
};

const guide = { id: 'guide', description: 'The guide documents the verified setup command' };
const delivery = {
  id: 'delivered',
  description: 'GitHub CI passes and the host records the staging merge',
};

const focus = {
  purpose: 'Update the setup guide and deliver it through GitHub to staging',
  objectives: ['Explain the setup command'],
  constraints: ['Use the configured review and delivery gates'],
};

/** Model a Director plan for a goal that explicitly asks for GitHub staging delivery. */
function stagingPlan(includeDeliveryCriterion: boolean): Plan {
  return {
    focus,
    milestones: [
      {
        id: 'guide',
        owner: 'docs',
        criteria: includeDeliveryCriterion ? [guide, delivery] : [guide],
        steps: activities.map((activity) => ({
          activity,
          ...(activity === 'documentation'
            ? { checklist: [{ id: 'write', criteria: [guide.id], expected: guide.description }] }
            : activity === 'release'
              ? {
                  checklist: [
                    {
                      id: 'observe',
                      criteria: [includeDeliveryCriterion ? delivery.id : guide.id],
                      expected: delivery.description,
                    },
                  ],
                }
              : { checklist: [], inapplicable: 'Outside this documentation contribution' }),
        })),
      },
    ],
  };
}

test('a staging goal admits engineering acceptance with GitHub evidence on the Release step', () => {
  const plan = stagingPlan(false);
  validatePlan(capture, plan);
  validateVerdict(
    plan,
    { digest: 'candidate', evidence: ['guide.diff'] },
    { kind: 'accepted', candidate: 'candidate', criteria: [guide.id], evidence: ['guide.diff'] },
  );
});

test('a Release observation cannot become an independently reviewed acceptance criterion', () => {
  assert.throws(
    () => validatePlan(capture, stagingPlan(true)),
    /Acceptance criterion delivered needs an applicable steward Step before delivery/,
  );
});
