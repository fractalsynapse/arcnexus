import type { Feedback, StewardCheckFailure } from '../../direction/src/index.js';
import type { CheckResult } from './check.js';

export interface StewardScope {
  owner: string;
  activity: StewardCheckFailure['activity'];
}

interface CheckEvent {
  feedback?: Feedback;
  check?: CheckResult;
  scope?: StewardScope;
}

/** Recover the still-unmet check from existing observations for this steward activity. */
export function pendingStewardCheck(events: readonly unknown[], scope: StewardScope) {
  const recorded = events as readonly CheckEvent[];
  const index = recorded.findLastIndex(
    ({ feedback }) =>
      feedback?.kind === 'supplier' &&
      feedback.owner === scope.owner &&
      feedback.failedCheck?.activity === scope.activity,
  );
  const feedback = recorded[index]?.feedback;
  if (feedback?.kind !== 'supplier' || !feedback.failedCheck) return;
  const failed = feedback.failedCheck;
  const passed = recorded
    .slice(index + 1)
    .some(
      ({ check, scope: observed }) =>
        observed?.owner === scope.owner &&
        observed.activity === scope.activity &&
        check?.id === failed.id &&
        typeof check.status === 'number' &&
        (check.status === 0) === (failed.expected === 'pass'),
    );
  return passed ? undefined : failed;
}
