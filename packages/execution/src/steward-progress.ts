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
  const repair = events.findLast(
    (event) => 'position' in event && event.repair?.milestone === milestone.id,
  );
  return {
    completedActivities,
    ...(repair && 'position' in repair && repair.repair
      ? {
          localRepair: {
            ...repair.repair,
            targetCompleted: completedActivities.some(
              (activity) => activity === repair.repair!.activity,
            ),
          },
        }
      : {}),
  };
}
