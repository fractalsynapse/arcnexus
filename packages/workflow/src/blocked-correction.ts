import type { Milestone, RevisionFeedback } from '../../direction/src/index.js';
import type { ActivityCheckpoint, TaskEvent } from './services.js';

/** Route a fresh review diagnostic through the ordinary supplier sequence. */
export function blockedCorrection(
  events: readonly TaskEvent[],
  milestone: Milestone | undefined,
  activation: ActivityCheckpoint,
): Extract<RevisionFeedback, { kind: 'supplier' }> | undefined {
  const { owner, step, outcome } = activation;
  if (outcome.kind !== 'blocked' || milestone?.id !== activation.milestone) return;
  if (outcome.failedCheck) return;
  if (!recoverableReview(events, milestone, owner, step, outcome.reason)) return;
  return {
    kind: 'supplier',
    milestone: milestone.id,
    requester: milestone.id,
    owner,
    reason: `The ${step} correction stalled: ${outcome.reason}\nSchedule smaller independently runnable contributions before the paused step. Preserve the original criterion, owner and checked work. If an actual prerequisite needs a human decision, ask for it without marking the correction complete.`,
    evidence: outcome.evidence,
  };
}

/** Hold a repeated diagnostic while allowing a distinct finding after earlier correction work. */
function recoverableReview(
  events: readonly TaskEvent[],
  milestone: Milestone,
  owner: string,
  step: ActivityCheckpoint['step'],
  reason: string,
) {
  const reviewIndex = events.findLastIndex((event) => 'verdict' in event);
  const review = events[reviewIndex];
  if (!review || !('verdict' in review) || review.verdict.kind !== 'rejected') return false;
  const criteria = new Set(
    milestone.steps
      .find(({ activity }) => activity === step)
      ?.checklist.flatMap((item) => item.criteria),
  );
  if (
    !review.verdict.findings.some(
      (finding) => finding.owner === owner && criteria.has(finding.criterion),
    )
  )
    return false;
  return !previousHolds(events.slice(reviewIndex + 1), owner, step).some(
    (activation) => activation.outcome.kind === 'blocked' && activation.outcome.reason === reason,
  );
}

/** Read the prior same-owner holds, excluding the just-recorded current activation. */
function previousHolds(
  events: readonly TaskEvent[],
  owner: string,
  step: ActivityCheckpoint['step'],
) {
  return events
    .flatMap((event) =>
      'activation' in event &&
      event.activation.owner === owner &&
      event.activation.step === step &&
      event.activation.outcome.kind === 'blocked'
        ? [event.activation]
        : [],
    )
    .slice(0, -1);
}
