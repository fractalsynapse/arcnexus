import type { Assignment } from '../architecture/assignment.js';

/** Normalizes director and dependency intent identically before captured authority is resolved. */
export function assignmentIntent(
  objective: string,
  acceptance: string[],
  proposed: Partial<Assignment> = {},
): Assignment {
  return {
    schemaVersion: 3,
    kind: proposed.kind ?? 'change',
    changeType: proposed.changeType ?? 'behavior',
    objective,
    expectedOutcome: objective,
    acceptanceCriteria: acceptance.length ? acceptance : [objective],
    allowedWritePaths: proposed.allowedWritePaths,
    hostChecks: [],
  };
}
