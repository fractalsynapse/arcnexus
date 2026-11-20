import type { VerifiedGoalRun } from '../../execution/src/index.js';
import { team } from '../../team/src/index.js';
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

export interface StewardCheckFailure {
  diagnostic?: string;
  activity: Exclude<PlanActivity, 'release'>;
  id: string;
  expected: 'pass' | 'fail';
  status: number;
  log: string;
}

export type RevisionFeedback =
  | { kind: 'rejection'; findings: readonly Rejection[] }
  | {
      kind: 'supplier';
      milestone: string;
      requester: string;
      owner: string;
      reason: string;
      question?: string;
      evidence: readonly string[];
      failedCheck?: StewardCheckFailure;
    }
  | { kind: 'answer'; question: string; answer: string; evidence: readonly string[] };

export type Feedback =
  RevisionFeedback | { kind: 'plan-repair'; diagnostic: string; original?: RevisionFeedback };

export interface StandingGoalEvidence {
  readonly revision: string;
  readonly source: Capture['source'];
  readonly recentChanges: readonly string[];
  readonly run?: VerifiedGoalRun;
  readonly requiresRun?: boolean;
}

export interface GoalAssessment {
  readonly kind: 'satisfied';
  readonly summary: string;
  readonly evidence: readonly string[];
}

export type DirectionResult =
  | { kind: 'plan'; plan: Plan }
  | GoalAssessment
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
  validateEngineeringCoverage(plan, acceptance.keys());
}

/** Require every acceptance ID to be covered before the host-owned Release step. */
function validateEngineeringCoverage(plan: Plan, criteria: Iterable<string>) {
  const covered = new Set<string>();
  for (const { steps } of plan.milestones) {
    for (const { activity, checklist, inapplicable } of steps) {
      if (activity === 'release' || inapplicable) continue;
      for (const { criteria } of checklist) {
        for (const id of criteria) covered.add(id);
      }
    }
  }
  for (const id of criteria) {
    if (!covered.has(id))
      throw new Error(
        `Acceptance criterion ${id} needs an applicable steward Step before delivery`,
      );
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
  const owner = team.list(capture.components, { component: milestone.owner })[0];
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

/** Confirm a linked contribution is complete or runnable work is ahead of the paused milestone. */
export function scheduledSupplier(
  before: Plan,
  after: Plan,
  feedback: Extract<Feedback, { kind: 'supplier' }>,
  completed: number,
  positions: ReadonlyMap<string, number>,
) {
  const linked = before.milestones.findIndex(
    ({ id }) => id === feedback.milestone && id !== feedback.requester,
  );
  if (linked >= 0 && before.milestones[linked]?.owner !== feedback.owner) return;
  if (linked >= 0 && linked < completed) return before.milestones[linked]?.id;

  const requester = after.milestones.findIndex(({ id }) => id === feedback.requester);
  if (requester < completed) return;
  return after.milestones.slice(completed, requester).find(({ id, owner, steps }) => {
    if (owner !== feedback.owner || (linked >= 0 && id !== feedback.milestone)) return false;
    if (feedback.failedCheck && before.milestones.some((milestone) => milestone.id === id))
      return false;
    return steps.slice(positions.get(id) ?? 0).some(({ activity, inapplicable }) => {
      if (activity === 'release' || inapplicable) return false;
      return !feedback.failedCheck || activity === feedback.failedCheck.activity;
    });
  })?.id;
}

export { direct, track } from './native.js';
export {
  decodeDirectorResponse,
  decodeRevisionResponse,
  DirectorResponseError,
} from './response.js';
export type { RevisionRequest } from './response.js';
