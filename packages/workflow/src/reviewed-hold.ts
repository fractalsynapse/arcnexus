import type { HoldContext } from '../../execution/src/index.js';
import type { RevisionFeedback } from '../../direction/src/index.js';
import {
  stopped,
  type ActivityCheckpoint,
  type TaskSession,
  type TaskOutcome,
} from './services.js';

/** Route retained independent-review corrections without turning genuine prerequisites into work. */
export function reviewedHold(
  session: TaskSession,
  activation: ActivityCheckpoint,
  revise: (feedback: RevisionFeedback) => Promise<TaskOutcome | undefined>,
) {
  const outcome = activation.outcome;
  if (outcome.kind !== 'blocked' || !outcome.holdContext)
    return stopped(
      'blocked',
      outcome.kind === 'blocked' ? outcome.reason : 'Expected a hold',
      outcome.evidence,
    );
  const held = outcome.holdContext;
  if (held.prerequisite && !held.prerequisite.satisfied)
    return stopped('blocked', held.prerequisite.requiredAction, outcome.evidence);
  const events = session.history?.() ?? [];
  const previous = events.findLastIndex(
    (event) => 'reviewedHold' in event && sameHold(event.reviewedHold, held),
  );
  if (previous >= 0 && events.slice(previous + 1).some((event) => 'plan' in event))
    return stopped('blocked', unresolvedHold(held), outcome.evidence);
  if (previous < 0) session.record({ reviewedHold: held });
  return revise(holdFeedback(held, activation));
}

/** Compare host-observed relevant inputs and finding, excluding incidental artifact allocation. */
function sameHold(previous: HoldContext, current: HoldContext) {
  return (
    previous.milestone === current.milestone &&
    previous.activity === current.activity &&
    previous.progress.identity === current.progress.identity
  );
}

/** Preserve an actionable original criterion and exact diagnostic when correction made no progress. */
function unresolvedHold(held: HoldContext) {
  const criteria = held.rejection.findings.map((finding) => finding.criterion).join(', ');
  return `Unresolved criteria ${criteria}: ${held.failure.diagnostic}. Required next action: correct the retained finding or supply new relevant checked evidence before continuing.`;
}

/** Reuse Direction's native explicit correction route with the exact observed check or edit evidence. */
function holdFeedback(
  held: HoldContext,
  activation: ActivityCheckpoint,
): Extract<RevisionFeedback, { kind: 'supplier' }> {
  const check = held.failure.check;
  return {
    kind: 'supplier',
    owner: activation.owner,
    milestone: activation.milestone,
    requester: activation.milestone,
    reason: held.failure.diagnostic,
    evidence: [...new Set([...activation.outcome.evidence, ...(check ? [check.log] : [])])],
    ...(check && typeof check.status === 'number'
      ? {
          failedCheck: {
            id: check.id,
            activity: held.activity,
            expected: held.failure.expected ?? 'pass',
            status: check.status,
            log: check.log,
            diagnostic: held.failure.diagnostic,
          },
        }
      : {}),
  };
}
