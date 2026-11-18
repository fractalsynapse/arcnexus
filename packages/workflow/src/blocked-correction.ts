import type { Milestone, RevisionFeedback } from '../../direction/src/index.js';
import type { ActivityCheckpoint, TaskEvent } from './services.js';

/** Route an unresolved review criterion through one existing same-owner supplier sequence. */
export function blockedCorrection(
  events: readonly TaskEvent[],
  milestone: Milestone | undefined,
  activation: ActivityCheckpoint,
): Extract<RevisionFeedback, { kind: 'supplier' }> | undefined {
  const { owner, step, outcome } = activation;
  if (outcome.kind !== 'blocked' || milestone?.id !== activation.milestone) return;
  if (!unaddressedReview(events, milestone, owner, step)) return;
  return {
    kind: 'supplier',
    milestone: milestone.id,
    requester: milestone.id,
    owner,
    reason: `The ${step} correction stalled: ${outcome.reason}\nSchedule smaller independently runnable contributions before the paused step. Preserve the original criterion, owner and checked work. If an actual prerequisite needs a human decision, ask for it without marking the correction complete.`,
    evidence: outcome.evidence,
  };
}

/** Let the accepted plan show whether this review has already received supplier work. */
function unaddressedReview(
  events: readonly TaskEvent[],
  milestone: Milestone,
  owner: string,
  step: ActivityCheckpoint['step'],
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
  if (
    events
      .slice(reviewIndex + 1)
      .some((event) => 'supplier' in event && event.supplier?.request.owner === owner)
  )
    return false;
  return true;
}
