import type { Feedback, StewardCheckFailure } from '../../direction/src/index.js';
import type { CheckResult } from './check.js';

export interface StewardScope {
  owner: string;
  activity: StewardCheckFailure['activity'];
  expected?: StewardCheckFailure['expected'];
}

interface CheckEvent {
  feedback?: Feedback;
  check?: CheckResult;
  scope?: StewardScope;
}

interface ObservedRecovery {
  qualifying: boolean;
  pending?: StewardCheckFailure;
}

/** Finds the latest recorded check and keeps it pending until its expectation passes. */
function recoverObservedCheck(
  recorded: readonly CheckEvent[],
  scope: StewardScope,
): ObservedRecovery {
  const event = recorded.findLast(
    ({ check, scope: observed }) =>
      observed?.owner === scope.owner &&
      observed.activity === scope.activity &&
      observed.expected &&
      check?.id &&
      typeof check.status === 'number',
  );
  if (!event?.check || !event.scope?.expected) return { qualifying: false };
  if ((event.check.status === 0) === (event.scope.expected === 'pass')) return { qualifying: true };
  return {
    qualifying: true,
    pending: {
      activity: scope.activity,
      id: event.check.id,
      expected: event.scope.expected,
      status: event.check.status as number,
      log: event.check.log,
    },
  };
}

/** Recovers supplier feedback unless a later matching check satisfies its expectation. */
function recoverFeedbackCheck(recorded: readonly CheckEvent[], scope: StewardScope) {
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

/** Resolves pending check recovery from observations before consulting feedback. */
export function pendingStewardCheck(events: readonly unknown[], scope: StewardScope) {
  const recorded = events as readonly CheckEvent[];
  const observed = recoverObservedCheck(recorded, scope);
  return observed.qualifying ? observed.pending : recoverFeedbackCheck(recorded, scope);
}
