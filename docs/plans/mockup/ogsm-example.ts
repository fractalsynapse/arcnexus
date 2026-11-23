import type { DesignFile, Goal, Milestone } from './model.ts';

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
  ],
};

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
  snapshots: [{ kind: 'planned', seq: 1, run: 0, at: '', capturedRevision: '' }],
  positions: [],
  review: [],
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
  delivery: { files: [], publication: null },
  hostedFailures: [],
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
