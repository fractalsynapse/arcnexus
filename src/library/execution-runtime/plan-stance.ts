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

/**
 * Ends an in-place run without the delivery route, stating honestly what it achieved.
 *
 * There is no candidate to integrate: nothing is committed, pushed, and no issue, comment, pull
 * request or release is opened. Returning true tells the caller the run is finished, so the goal
 * delivery path is never entered. `stopped` is used rather than `completed` because no route
 * completed — the work exists in the operator's checkout and they decide what happens to it.
 *
 * Sealing itself is an environment property: both sealed stances capture a simulation environment,
 * whose provider records issues, comments and pull requests locally through the same effect
 * executor real GitHub uses. In-place differs from a simulated run only in where work is written.
 */
export function recordInPlaceCompletion(store: ExecutionStore, run: ExecutionRun): boolean {
  const stance = run.data.stance as { kind?: string } | undefined;
  if (stance?.kind !== 'component') return false;
  // Nothing was admitted: the addressed component planned and found no work to do. Stopping is
  // correct, claiming completion is not, so the outcome names what actually happened.
  if (!Number(run.data.inPlaceAdmitted ?? 0)) {
    store.updateRun(run.id, 'stopped', { inPlaceOutcome: 'nothing admitted' });
    return true;
  }
  const prepared = store
    .assignments(run.id)
    .filter((assignment) => assignment.status === 'prepared').length;
  store.updateRun(run.id, 'stopped', {
    inPlaceComplete: true,
    inPlaceOutcome:
      `in place: ${String(run.data.inPlaceAdmitted)} assignment(s) planned` +
      (prepared ? `, ${String(prepared)} prepared for the operator to judge` : '') +
      '; nothing was assembled, committed or published',
  });
  return true;
}
