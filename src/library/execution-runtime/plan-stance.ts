import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';

/** A direction result reduced to what a plan-only run should retain. */
export interface PlanOutcome {
  summary?: string;
  owners?: unknown;
  questions?: unknown;
}

/**
 * Records that a plan stance finished direction, without claiming any delivery.
 *
 * A plan run asked only to see the proposal, so nothing was dispatched, integrated or published;
 * `stopped` is the only honest terminal state. The plan itself stays in the direction record this
 * writes alongside, so the run report can show where to read it.
 */
export function recordPlanOutcome(
  store: ExecutionStore,
  run: ExecutionRun,
  outcome: PlanOutcome,
): void {
  store.updateRun(run.id, 'stopped', {
    planOnly: true,
    planSummary: outcome.summary ?? '',
    planOwners: outcome.owners ?? [],
    planQuestions: outcome.questions ?? [],
  });
}
