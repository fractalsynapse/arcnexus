import { activityRank, type Activity } from './activities.js';

/**
 * The three ways an agent can stand in a lane, and the activity sequence each one runs.
 *
 * A mode is not a role. A **role** is a position that holds one activity — researcher,
 * technical-writer, designer, systems-engineer, reviewer, release-engineer — carrying the standing
 * responsibilities, instructions, standards and execution profile reusable across every component.
 * A **mode** is what an activation is doing in the lane, and it decides which activities the plan
 * must declare. Conflating them is what let one bundled role imply that every agent performs every
 * activity, which made a verifier declare implementation work it is not authorized to do.
 */
export const modes = ['director', 'steward', 'verifier'] as const;

export type Mode = (typeof modes)[number];

/**
 * Activity sequences per mode, in canonical order.
 *
 * The director's `implementation` activity produces the plan and the assignments rather than a
 * source change, and it has no `testing` step because the acceptance is authored, not executed.
 * The steward runs the full chain. The verifier researches and documents what it examined, then
 * reviews and releases **the verdict and report**; it never implements or designs tests, which is
 * what keeps one verdict independent of the work it judges.
 */
export const modeSequences: Record<Mode, readonly Activity[]> = {
  director: ['research', 'documentation', 'implementation', 'review', 'release'],
  steward: ['research', 'documentation', 'testing', 'implementation', 'review', 'release'],
  verifier: ['research', 'documentation', 'review', 'release'],
};

/**
 * The sequence a mode must plan, narrowed to what the component actually supports.
 *
 * A component that holds no `release` activity — because it declares no delivery operation — is not
 * asked to plan one, so the requirement is always satisfiable by the role that component engaged.
 */
export function modeSequence(mode: Mode, supported: readonly string[]): Activity[] {
  const allowed = new Set(supported);
  return modeSequences[mode]
    .filter((activity) => allowed.has(activity))
    .sort((a, b) => activityRank(a) - activityRank(b));
}

/**
 * The mode an assignment runs as.
 *
 * A review assignment is the independent verifier; everything else is a steward delivering one
 * assignment. Direction is not reachable here: it happens before assignments exist and is resolved
 * through its own path, so the director never arrives as an assignment kind.
 */
export function modeFor(assignment: { kind: string }): Mode {
  return assignment.kind === 'review' ? 'verifier' : 'steward';
}
