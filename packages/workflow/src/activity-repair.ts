import type { Capture } from '../../architecture/src/index.js';
import type { Milestone } from '../../direction/src/index.js';
import {
  stopped,
  type ActivityCheckpoint,
  type ActivityRepair,
  type TaskEvent,
} from './services.js';

/** Validate a local rewind without changing accepted work, authority or the Director's sequence. */
export function activityRepair(
  capture: Capture,
  milestone: Milestone,
  activation: ActivityCheckpoint,
  events: readonly TaskEvent[],
) {
  const outcome = activation.outcome;
  if (outcome.kind !== 'repair') throw new Error('Expected a local activity repair');
  const index = milestone.steps.findIndex(({ activity }) => activity === outcome.activity);
  const step = milestone.steps[index];
  if (
    milestone.id !== activation.milestone ||
    milestone.owner !== activation.owner ||
    !step ||
    step.inapplicable ||
    index > activation.index ||
    !capture.components[milestone.owner]?.activities[outcome.activity]
  )
    return stopped(
      'blocked',
      `Unavailable local repair: ${milestone.owner}/${outcome.activity}`,
      outcome.evidence,
    );
  const { activity, reason, input, evidence } = outcome;
  const repair: ActivityRepair = { milestone: milestone.id, activity, reason, input, evidence };
  return seenRepair(events, repair)
    ? stopped('blocked', outcome.reason, outcome.evidence)
    : { index, repair };
}

/** Stop revisiting a finding when the host's recorded component inputs have not changed. */
function seenRepair(events: readonly TaskEvent[], repair: ActivityRepair) {
  return events.some(
    (event) =>
      'position' in event &&
      event.repair &&
      event.repair.milestone === repair.milestone &&
      event.repair.activity === repair.activity &&
      event.repair.reason === repair.reason &&
      event.repair.input === repair.input,
  );
}
