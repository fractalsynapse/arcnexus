import type { Capture } from '../../architecture/src/index.js';
import { supplierLinkDiagnostic, type Milestone, type Plan } from '../../direction/src/index.js';
import {
  stopped,
  selfLinkedSupplier,
  type ActivityCheckpoint,
  type ActivityRepair,
  type TaskEvent,
} from './services.js';

/** Resume the caller of an invalid retained supplier request without sending it to Direction. */
export function supplierRequestRepair(plan: Plan, activation: ActivityCheckpoint) {
  const diagnostic = supplierLinkDiagnostic(plan, {
    ...activation.outcome,
    requester: activation.milestone,
  });
  if (diagnostic)
    return {
      phase: 'activity' as const,
      message: diagnostic,
      evidence: activation.outcome.evidence,
    };
}

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
    step.activity === 'review' ||
    step.activity === 'release' ||
    step.inapplicable ||
    index > from ||
    !capture.components[milestone.owner]?.activities[activity]
  )
    return;
  return index;
}

/** Expose exactly the editable activities the current caller may revisit under captured authority. */
export function localRepairTargets(capture: Capture, milestone: Milestone, from: number) {
  return milestone.steps
    .filter(({ activity }) => localRepairIndex(capture, milestone, from, activity) !== undefined)
    .map(({ activity }) => activity);
}

/** Replay completed valid transitions; unavailable responses resume their caller at the retained cursor. */
export function replayableActivity(
  capture: Capture,
  milestone: Milestone | undefined,
  activation: ActivityCheckpoint,
) {
  return (
    activation.outcome.kind !== 'blocked' &&
    !selfLinkedSupplier(activation.outcome, activation.milestone) &&
    !invalidRetainedRepair(capture, milestone, activation)
  );
}

/** Retry a legacy malformed response at its original cursor rather than replay its invalid transition. */
function invalidRetainedRepair(
  capture: Capture,
  milestone: Milestone | undefined,
  activation: ActivityCheckpoint,
) {
  if (!milestone || activation.outcome.kind !== 'repair') return false;
  const step = milestone.steps[activation.index];
  return (
    milestone.id === activation.milestone &&
    milestone.owner === activation.owner &&
    step?.activity === activation.step &&
    !step.inapplicable &&
    Boolean(capture.components[milestone.owner]?.activities[activation.step]) &&
    localRepairIndex(capture, milestone, activation.index, activation.outcome.activity) ===
      undefined
  );
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
