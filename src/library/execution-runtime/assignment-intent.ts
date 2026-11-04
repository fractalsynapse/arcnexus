import { InputError } from '../architecture/config.js';
import type { Assignment } from '../architecture/assignment.js';

/** Normalizes director and dependency intent identically before captured authority is resolved. */
export function assignmentIntent(
  objective: string,
  acceptance: string[],
  proposed: Partial<Assignment> = {},
): Assignment {
  if (Object.hasOwn(proposed, 'allowedWritePaths'))
    throw new InputError(
      'Assignment file lists are retired; the component steward selects its own files',
    );
  return {
    schemaVersion: 3,
    kind: proposed.kind ?? 'change',
    changeType: proposed.changeType ?? 'behavior',
    objective,
    expectedOutcome: objective,
    acceptanceCriteria: acceptance.length ? acceptance : [objective],
    hostChecks: [],
  };
}
