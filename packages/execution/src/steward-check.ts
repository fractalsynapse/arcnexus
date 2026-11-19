import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  owner?: string;
  edits?: readonly { path: string; before: string | null; after: string | null }[];
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
  const candidates = recorded
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.scope?.owner === scope.owner &&
        event.scope.activity === scope.activity &&
        event.scope.expected &&
        event.check?.id &&
        typeof event.check.status === 'number',
    );
  for (const { event, index } of candidates.reverse()) {
    const check = event.check;
    const expected = event.scope?.expected;
    if (!check || !expected) continue;
    if ((check.status === 0) === (expected === 'pass')) continue;
    const resolved = recorded.slice(index + 1).some(
      ({ check: later, scope: laterScope }) =>
        laterScope?.owner === scope.owner &&
        laterScope.activity === scope.activity &&
        laterScope.expected === expected &&
        later?.id === check.id &&
        typeof later.status === 'number' &&
        (later.status === 0) === (expected === 'pass'),
    );
    if (resolved) continue;
    return {
      qualifying: true,
      pending: {
        activity: scope.activity,
        id: check.id,
        expected,
        status: check.status,
        log: check.log,
      },
    };
  }
  return { qualifying: candidates.length > 0 };
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

/** Compare actual failure diagnostics while ignoring TAP numbering and transient process paths. */
export function checkFailureSignature(log: string) {
  const text = readFileSync(log, 'utf8');
  const lines = text
    .split('\n')
    .filter((line) => /(?:^not ok \d+ - |error TS\d+:|^\s*(?:error:|Error:|FAIL\b))/.test(line));
  const details = text.match(/^ {2}error:[^\n]*(?:\n(?: {4}.*|[ \t]*))*/gm) ?? [];
  const normalized = (lines.length ? [...lines, ...details].join('\n') : text)
    .replace(/not ok \d+ - /g, 'not ok - ')
    .replace(/\([^\n]*?\d+,\d+\)/g, '')
    .replace(/\/[^\s]*?\/(?:worktree|measure-worktree)\//g, '')
    .replace(/\/tmp\/[\w.-]+/g, '/tmp/<temporary>')
    .replace(/:\d+:\d+/g, '')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

/** Recognize checked task-input changes, including supplier contributions, since the diagnosis. */
export function correctionMadeProgress(events: readonly unknown[], log: string) {
  const recorded = events as readonly CheckEvent[];
  const observed = recorded.findLastIndex(({ check }) => check?.log === log);
  return recorded
    .slice(observed + 1)
    .some(({ edits }) => edits?.some(({ before, after }) => before !== after));
}

/** Identify the latest secured task edit inputs without copying their contents. */
export function stewardInput(events: readonly unknown[]) {
  const files = new Map<string, string | null>();
  for (const event of events as readonly CheckEvent[]) {
    for (const edit of event.edits ?? []) files.set(edit.path, edit.after);
  }
  return createHash('sha256')
    .update(JSON.stringify([...files].sort()))
    .digest('hex');
}
