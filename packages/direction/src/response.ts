import { citesVerifiedRun } from '../../execution/src/index.js';
import { revisionCitation } from '../../architecture/src/index.js';
import { activities, validateCorrection, validatePlan, validateRevision, type DirectionResult, type Milestone, type Plan, type RevisionFeedback, type StandingGoalEvidence } from './index.js';

/** Carry a rejected Director proposal's diagnostic across the planning boundary. */
export class DirectorResponseError extends Error {}

/** Decode arbitrary model output before plan rules inspect its fields. */
export function decodeDirectorResponse(
  response: unknown,
  standing?: StandingGoalEvidence,
): DirectionResult {
  const value = mapping(response, 'response');
  if (value.kind === 'question') {
    string(value.question, 'question');
    if (!value.question.trim())
      throw new DirectorResponseError('question: expected a nonempty human question');
    list(value.evidence, 'evidence', string);
  } else if (value.kind === 'plan') {
    const plan = mapping(value.plan, 'plan');
    const focus = mapping(plan.focus, 'plan.focus');
    string(focus.purpose, 'plan.focus.purpose');
    list(focus.objectives, 'plan.focus.objectives', string);
    list(focus.constraints, 'plan.focus.constraints', string);
    list(plan.milestones, 'plan.milestones', milestone);
  } else if (standing && value.kind === 'satisfied') {
    return assessment(value, standing);
  } else {
    const expected = standing ? '"plan", "question", or "satisfied"' : '"plan" or "question"';
    throw new DirectorResponseError(`response.kind: expected ${expected}`);
  }
  return response as DirectionResult;
}

/** Admit inaction only with an explicit rationale and revision-applicable source evidence. */
function assessment(
  value: Record<string, unknown>,
  standing: StandingGoalEvidence,
): DirectionResult {
  string(value.summary, 'summary');
  if (!value.summary.trim())
    throw new DirectorResponseError('summary: explain why no engineering work is warranted');
  if (!Array.isArray(value.evidence) || !value.evidence.length)
    throw new DirectorResponseError('A standing goal assessment needs captured evidence');
  try {
    const run = standing.run;
    const hasRun = value.evidence.some((entry) => citesVerifiedRun(entry, run, standing.revision));
    if (standing.requiresRun && !hasRun)
      throw new Error(
        'A measure that requires an observed run needs an applicable verified run citation',
      );
    const evidence = value.evidence.map((entry) => {
      if (run && citesVerifiedRun(entry, run, standing.revision))
        return `${run.id} · ${run.revision} · ${run.pull ?? 'unchanged tree review'}`;
      const { path, quote } = revisionCitation(entry, standing.source);
      if (path.startsWith('.arc/goals/'))
        throw new Error('The authored goal alone is not satisfaction evidence');
      return `${standing.revision}:${path} · ${quote}`;
    });
    return { kind: 'satisfied', summary: value.summary, evidence };
  } catch (error) {
    throw new DirectorResponseError((error as Error).message, { cause: error });
  }
}

/** Check the fields consumed by milestone admission and scope validation. */
function milestone(value: unknown, path: string): void {
  const entry = mapping(value, path);
  string(entry.id, `${path}.id`);
  string(entry.owner, `${path}.owner`);
  list(entry.criteria, `${path}.criteria`, (value, path) => {
    const criterion = mapping(value, path);
    string(criterion.id, `${path}.id`);
    string(criterion.description, `${path}.description`);
  });
  list(entry.steps, `${path}.steps`, step);
}

/** Check activity data and include the full field path for repair feedback. */
function step(value: unknown, path: string): void {
  const entry = mapping(value, path);
  string(entry.activity, `${path}.activity`);
  if (!activities.some((activity) => activity === entry.activity))
    throw new DirectorResponseError(`${path}.activity: expected one of ${activities.join(', ')}`);
  if (entry.inapplicable !== undefined) string(entry.inapplicable, `${path}.inapplicable`);
  list(entry.checklist, `${path}.checklist`, (value, path) => {
    const item = mapping(value, path);
    string(item.id, `${path}.id`);
    list(item.criteria, `${path}.criteria`, string);
    string(item.expected, `${path}.expected`);
  });
}

/** Host-owned immutable references and committed cursor for a revision activation. */
export interface RevisionRequest {
  acceptedPlan: string;
  retainedEvidence: string;
  position: { completed: number; activities: Readonly<Record<string, number>> };
  finding: RevisionFeedback;
}

/** Reconstruct and validate a pending-only proposal without mutating accepted inputs. */
export function decodeRevisionResponse(
  response: unknown,
  capture: import('../../architecture/src/index.js').Capture,
  accepted: Plan,
  request: RevisionRequest,
): DirectionResult {
  const value = mapping(response, 'response');
  if (value.kind === 'question') return revisionQuestion(value);
  if (value.kind !== 'plan') throw new DirectorResponseError('response.kind: expected "plan"');
  const proposedPlan = mapping(value.plan, 'plan');
  if ('focus' in proposedPlan) throw new DirectorResponseError('plan.focus: revisions cannot replace Focus');
  list(proposedPlan.milestones, 'plan.milestones', milestone);
  const { completed, activities: positions } = request.position;
  if (!Number.isInteger(completed) || completed < 0 || completed > accepted.milestones.length)
    throw new DirectorResponseError('position.completed: outside accepted milestone sequence');

  const prefix = accepted.milestones.slice(0, completed);
  validatePositions(positions, accepted, completed);
  const proposed = proposedPlan.milestones as Milestone[];
  const proposedIDs = new Set<string>();
  const reconstructed: Milestone[] = [...prefix];
  for (const candidate of proposed) {
    if (proposedIDs.has(candidate.id) || prefix.some(({ id }) => id === candidate.id))
      throw new DirectorResponseError(`plan.milestones: duplicate or completed milestone ${candidate.id}`);
    proposedIDs.add(candidate.id);
    const original = accepted.milestones.find(({ id }) => id === candidate.id);
    if (!original) {
      reconstructed.push(candidate);
      continue;
    }
    if (candidate.owner !== original.owner)
      throw new DirectorResponseError(`plan.milestones[${candidate.id}].owner: changed accepted owner`);
    if (JSON.stringify(candidate.criteria) !== JSON.stringify(original.criteria))
      throw new DirectorResponseError(`plan.milestones[${candidate.id}].criteria: changed accepted acceptance`);
    const offset = positions[candidate.id] ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > original.steps.length)
      throw new DirectorResponseError(`position.activities.${candidate.id}: outside accepted Steps`);
    reconstructed.push({ ...original, steps: [...original.steps.slice(0, offset), ...candidate.steps] });
  }
  for (const original of accepted.milestones.slice(completed)) {
    if (!proposedIDs.has(original.id))
      throw new DirectorResponseError(`plan.milestones: missing pending accepted milestone ${original.id}`);
  }
  const plan: Plan = { focus: accepted.focus, milestones: reconstructed };
  try {
    validatePlan(capture, plan);
    validateRevision(accepted, plan, completed, new Map(Object.entries(positions)));
    if (request.finding.kind === 'rejection')
      validateCorrection(plan, completed, request.finding.findings);
  } catch (error) {
    throw new DirectorResponseError((error as Error).message, { cause: error });
  }
  return { kind: 'plan', plan };
}

/** Require an object before reading its named fields. */
function mapping(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return invalid(path, 'object', value);
  return value as Record<string, unknown>;
}

/** Require a string rather than coercing model data into text. */
function string(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') invalid(path, 'string', value);
}

/** Check every item with its indexed field path. */
function list(value: unknown, path: string, check: (value: unknown, path: string) => void): void {
  if (!Array.isArray(value)) invalid(path, 'array', value);
  value.forEach((entry, index) => check(entry, `${path}[${index}]`));
}

/** Describe both shapes without copying raw proposal data into a diagnostic. */
function invalid(path: string, expected: string, value: unknown): never {
  const received = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  throw new DirectorResponseError(`${path}: expected ${expected}, received ${received}`);
}
