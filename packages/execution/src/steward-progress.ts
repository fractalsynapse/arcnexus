import type { Milestone } from '../../direction/src/index.js';
import type { TaskEvent } from '../../workflow/src/index.js';

/** Project the canonical cursor so earlier repair findings cannot masquerade as unfinished work. */
export function stewardProgress(events: readonly TaskEvent[], milestone: Milestone) {
  const latest = events.findLast((event) => 'position' in event);
  const cursor =
    latest && 'position' in latest ? (latest.position.activities[milestone.id] ?? 0) : 0;
  const completedActivities = milestone.steps
    .slice(0, cursor)
    .filter((step) => !step.inapplicable)
    .map((step) => step.activity);
  const repairs = events.flatMap((event) =>
    'position' in event && event.repair?.milestone === milestone.id ? [event.repair] : [],
  );
  const repair = repairs.at(-1);
  const originatingFinding = repairs[0];
  return {
    completedActivities,
    previouslyCompletedActivities: previousCompletion(events, milestone),
    ...(repair
      ? {
          localRepair: {
            ...repair,
            ...(originatingFinding && !sameFinding(originatingFinding, repair)
              ? { originatingFinding }
              : {}),
            targetCompleted: completedActivities.some((activity) => activity === repair.activity),
          },
        }
      : {}),
  };
}

/** Compare exact finding content so a sole rewind is not repeated in its own context. */
function sameFinding(
  left: NonNullable<Extract<TaskEvent, { position: unknown }>['repair']>,
  right: NonNullable<Extract<TaskEvent, { position: unknown }>['repair']>,
) {
  return (
    left.activity === right.activity &&
    left.reason === right.reason &&
    JSON.stringify(left.evidence) === JSON.stringify(right.evidence)
  );
}

/** Keep historical completion distinct from the current post-rewind cursor. */
function previousCompletion(events: readonly TaskEvent[], milestone: Milestone) {
  return [
    ...new Set(
      events.flatMap((event) =>
        'activation' in event &&
        event.activation.milestone === milestone.id &&
        event.activation.owner === milestone.owner &&
        event.activation.outcome.kind === 'completed'
          ? [event.activation.step]
          : [],
      ),
    ),
  ];
}
