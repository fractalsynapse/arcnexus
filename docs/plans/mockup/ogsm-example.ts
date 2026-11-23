import type { DesignFile, Goal, Milestone, ReleaseCheck, RunRevision } from './model.ts';

const goalId = 'reduce-planner-file-discovery';
const title = 'Reduce repeated Planner file discovery';
const objective = 'Improve Planner efficiency while preserving decision quality.';

export const ogsmExample = {
  objective,
  measure: 'Median list-files calls per Planner activation',
  baseline: 24,
  target: 12,
  verified: 24,
  candidate: 16,
  strategy: 'Reuse a file inventory within each Planner activation.',
  rationale: 'Repeated directory scans are a source of avoidable tool calls during file discovery.',
  method:
    'Compare the same planning requests under the same execution profile. Count list-files calls per activation from the host tool log and report the median.',
  quality: 'Plans still cite the required files',
};

export const ogsmMilestone: Milestone = {
  id: 'reuse-planner-file-inventory',
  owner: 'planner',
  criteria: [
    { id: 'inventory-reuse', description: 'Reuse discovered paths within a Planner activation.' },
    { id: 'citation-coverage', description: ogsmExample.quality },
  ],
  steps: [
    {
      activity: 'testing',
      checklist: [{ id: 'compare-planner-runs', expected: ogsmExample.method }],
    },
    {
      activity: 'implementation',
      checklist: [{ id: 'reuse-inventory', expected: ogsmExample.strategy }],
    },
    {
      activity: 'review',
      checklist: [{ id: 'review-coverage', expected: ogsmExample.quality }],
    },
    {
      activity: 'release',
      checklist: [
        {
          id: 'verify-checkpoint',
          expected: 'Verify the checkpoint against the current staging base.',
        },
      ],
    },
  ],
};

const exampleStage = 'example-staging-base';
const exampleMerge = 'example-staging-merge';
const prChecks: ReleaseCheck[] = [
  {
    name: 'PR checks',
    state: 'passed',
    detail: 'Build and required tests passed for the reviewed PR head.',
  },
];
const externalReview: ReleaseCheck = {
  name: 'External review',
  state: 'passed',
  detail: 'Required review completed for the reviewed PR head.',
};

function exampleRelease(
  state: ReleaseCheck['state'],
  label: string,
  seq: number,
  detail: string,
): RunRevision {
  return {
    kind: 'merged',
    seq,
    run: 0,
    label,
    at: '',
    capturedRevision: exampleStage,
    release: {
      prChecks,
      externalReview,
      postMerge: {
        commit: exampleMerge,
        checks: [{ name: 'Staging CLI smoke check', state, detail }],
      },
    },
  };
}

export const ogsmGoal: Goal = {
  id: goalId,
  title,
  priority: 0,
  plan: [
    {
      seq: 0,
      purpose: objective,
      objectives: [ogsmExample.measure],
      constraints: [ogsmExample.quality],
      milestones: [ogsmMilestone],
    },
  ],
  snapshots: [
    exampleRelease(
      'passed',
      'Verified on staging',
      5,
      'The CLI started successfully from the artifact built at the staging merge.',
    ),
    exampleRelease(
      'failed',
      'Merged · checks failed',
      4,
      'The CLI startup check failed on the artifact built at the staging merge.',
    ),
    exampleRelease(
      'pending',
      'Merged · verifying',
      3,
      'Waiting for the CLI startup check on the artifact built at the staging merge.',
    ),
    {
      kind: 'accepted',
      seq: 2,
      run: 0,
      at: '',
      capturedRevision: exampleStage,
      label: 'Awaiting external review',
      release: {
        prChecks,
        externalReview: {
          ...externalReview,
          state: 'pending',
          detail: 'The PR is waiting for its configured external review.',
        },
      },
    },
  ],
  positions: [],
  review: [
    {
      kind: 'accepted',
      seq: 2,
      run: 0,
      at: '',
      candidate: 'example-reviewed-tree',
      criteria: ogsmMilestone.criteria.map((criterion) => criterion.id),
      checks: [],
      findings: [],
      action: null,
    },
  ],
  logs: [],
  activations: [],
  receipts: [],
  components: {
    planner: {
      purpose: 'Maintain standing goals and human objective records.',
      owns: ['packages/planner'],
      activities: {},
    },
  },
  delivery: {
    files: [],
    commit: exampleMerge,
    publication: {
      parent: exampleStage,
      candidate: 'example-reviewed-tree',
      branch: 'example-issue-branch',
      head: 'example-pr-head',
    },
  },
  hostedFailures: [],
  checkpoints: [
    {
      milestone: ogsmMilestone.id,
      seq: 1,
      base: exampleStage,
      commit: 'example-checkpoint',
      branch: 'example-issue-branch',
      checks: [
        {
          name: 'Integration checks',
          state: 'passed',
          detail: 'The checkpoint was tested against the observed staging base.',
        },
      ],
      issueComment:
        'Published the Planner inventory checkpoint on the shared issue branch. Integration checks passed against the tested staging revision.',
    },
  ],
  outcome: { kind: 'planned', summary: objective, at: '' },
};

export const ogsmGoalFile: DesignFile = {
  area: 'plan',
  type: 'Goal',
  path: `.arc/goals/${goalId}.md`,
  capture: '',
  revisions: [
    {
      id: 'Example',
      name: title,
      updated: 'Illustrative example',
      priority: null,
      topics: ['Planner', 'Efficiency'],
      content: `# ${title}\n\n**Objective.** ${objective}\n\n**Success measure.** Bring the median number of list-files calls per Planner activation to ${ogsmExample.target} or fewer.\n\n${ogsmExample.method}\n\n**Quality check.** ${ogsmExample.quality}.\n`,
    },
  ],
};
