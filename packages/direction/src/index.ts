import type { Capture } from '../../architecture/src/index.js';

export const activities = [
  'documentation',
  'testing',
  'implementation',
  'review',
  'release',
] as const;
export type PlanActivity = (typeof activities)[number];

export interface Criterion {
  id: string;
  description: string;
}

export interface Step {
  activity: PlanActivity;
  checklist: readonly { id: string; criteria: readonly string[]; expected: string }[];
  inapplicable?: string;
}

export interface Milestone {
  id: string;
  owner: string;
  criteria: readonly Criterion[];
  steps: readonly Step[];
}

export interface Plan {
  focus: { purpose: string; objectives: readonly string[]; constraints: readonly string[] };
  milestones: readonly Milestone[];
}

export interface Rejection {
  criterion: string;
  owner: string;
  evidence: readonly string[];
  reason: string;
}

export type Feedback =
  | { kind: 'rejection'; findings: readonly Rejection[] }
  | {
      kind: 'supplier';
      milestone: string;
      owner: string;
      reason: string;
      evidence: readonly string[];
    }
  | { kind: 'answer'; question: string; answer: string; evidence: readonly string[] };

export type DirectionResult =
  | { kind: 'plan'; plan: Plan }
  | { kind: 'question'; question: string; evidence: readonly string[] };

/** Check the Director's proposed work against captured ownership and the plan template. */
export function validatePlan(capture: Capture, plan: Plan) {
  if (!plan.focus.purpose.trim() || !plan.focus.objectives.length || !plan.focus.constraints.length)
    throw new Error('The Director plan needs a purpose, objectives and constraints');
  if (!plan.milestones.length) throw new Error('The Director plan has no milestones');
  const ids = new Set<string>();
  const acceptance = new Map<string, { owner: string; description: string }>();
  for (const milestone of plan.milestones) {
    if (!milestone.id.trim() || ids.has(milestone.id))
      throw new Error(`Duplicate or empty milestone id: ${milestone.id}`);
    ids.add(milestone.id);
    validateMilestone(capture, milestone);
    for (const { id, description } of milestone.criteria) {
      const existing = acceptance.get(id);
      if (
        !id.trim() ||
        !description.trim() ||
        (existing && (existing.owner !== milestone.owner || existing.description !== description))
      )
        throw new Error(`Conflicting acceptance criterion: ${id}`);
      acceptance.set(id, { owner: milestone.owner, description });
    }
  }
}

/** Require fresh work for each rejected criterion under its original accountable owner. */
export function validateCorrection(plan: Plan, completed: number, findings: readonly Rejection[]) {
  const pending = plan.milestones.slice(completed);
  for (const { owner, criterion } of findings) {
    if (
      !pending.some(
        (milestone) =>
          milestone.owner === owner &&
          milestone.steps.some(
            (step) =>
              step.activity !== 'release' &&
              step.checklist.some(({ criteria }) => criteria.includes(criterion)),
          ),
      )
    )
      throw new Error(`The Director did not schedule a correction for ${criterion}`);
  }
}

/** Validate checklist references and forbid work the component cannot perform. */
function validateMilestone(capture: Capture, milestone: Milestone) {
  const owner =
    Object.hasOwn(capture.components, milestone.owner) && capture.components[milestone.owner];
  if (!owner) throw new Error(`Unknown milestone owner: ${milestone.owner}`);
  const criteria = new Set(milestone.criteria.map(({ id }) => id));
  if (!criteria.size || criteria.size !== milestone.criteria.length)
    throw new Error(`Missing or duplicate acceptance criteria in ${milestone.id}`);
  if (milestone.steps.map(({ activity }) => activity).join() !== activities.join())
    throw new Error(`Milestone ${milestone.id} must include all five Steps in order`);
  const checklist = new Set<string>();
  for (const step of milestone.steps) {
    if (step.inapplicable?.trim() && !step.checklist.length) continue;
    if (step.inapplicable || !step.checklist.length)
      throw new Error(`Step ${milestone.id}/${step.activity} needs a checklist or a reason`);
    if (step.activity !== 'release' && !owner.activities[step.activity]?.profile)
      throw new Error(`Unavailable activity: ${milestone.owner}/${step.activity}`);
    for (const item of step.checklist) {
      if (
        !item.id.trim() ||
        checklist.has(item.id) ||
        !item.expected.trim() ||
        !item.criteria.length ||
        item.criteria.some((id) => !criteria.has(id))
      )
        throw new Error(`Invalid checklist item: ${milestone.id}/${item.id}`);
      checklist.add(item.id);
    }
  }
}

/** Preserve completed work and original acceptance while admitting a Director revision. */
export function validateRevision(
  before: Plan,
  after: Plan,
  completed: number,
  positions: ReadonlyMap<string, number>,
) {
  const unchanged = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right);
  if (!unchanged(before.focus, after.focus))
    throw new Error('A revised plan must preserve the accepted Focus');
  if (!unchanged(before.milestones.slice(0, completed), after.milestones.slice(0, completed)))
    throw new Error('A revised plan must preserve completed milestones');
  for (const milestone of before.milestones) {
    const current = after.milestones.find(({ id }) => id === milestone.id);
    if (current?.owner !== milestone.owner || !unchanged(current.criteria, milestone.criteria))
      throw new Error(`A revised plan must preserve owner and acceptance for ${milestone.id}`);
    const position = positions.get(milestone.id) ?? 0;
    if (!unchanged(milestone.steps.slice(0, position), current.steps.slice(0, position)))
      throw new Error(`A revised plan must preserve completed Steps for ${milestone.id}`);
  }
}

export { direct } from './native.js';
