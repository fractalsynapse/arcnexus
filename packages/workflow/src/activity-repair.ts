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
  const index = localRepairIndex(capture, milestone, activation.index, outcome.activity);
  if (
    milestone.id !== activation.milestone ||
    milestone.owner !== activation.owner ||
    index === undefined
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

/** Resolve an applicable rewind target without permitting a forward jump or changing captured authority. */
export function localRepairIndex(
  capture: Capture,
  milestone: Milestone,
  from: number,
  activity: ActivityRepair['activity'],
) {
  const index = milestone.steps.findIndex((step) => step.activity === activity);
  const step = milestone.steps[index];
  if (
    !step ||
    step.inapplicable ||
    index > from ||
    !capture.components[milestone.owner]?.activities[activity]
  )
    return;
  return index;
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
