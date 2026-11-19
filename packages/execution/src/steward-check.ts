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

/** Reconstruct unresolved operations in order; passing another check cannot erase a failure. */
export function pendingStewardCheck(events: readonly unknown[], scope: StewardScope, id?: string) {
  const pending = new Map<string, StewardCheckFailure>();
  for (const event of events as readonly CheckEvent[]) {
    const feedback = event.feedback;
    if (
      feedback?.kind === 'supplier' &&
      feedback.owner === scope.owner &&
      feedback.failedCheck?.activity === scope.activity &&
      !pending.has(feedback.failedCheck.id)
    )
      pending.set(feedback.failedCheck.id, feedback.failedCheck);
    observeCheck(pending, event, scope);
  }
  return id ? pending.get(id) : [...pending.values()].at(-1);
}

/** Resolve each operation against its original pending expectation, including legacy feedback. */
function observeCheck(
  pending: Map<string, StewardCheckFailure>,
  event: CheckEvent,
  scope: StewardScope,
) {
  const { check, scope: observed } = event;
  if (
    observed?.owner !== scope.owner ||
    observed.activity !== scope.activity ||
    !check?.id ||
    typeof check.status !== 'number'
  )
    return;
  const prior = pending.get(check.id);
  const expected = expectedObservation(scope, check.id, prior, observed);

  if (!expected) return;
  pending.delete(check.id);
  if ((check.status === 0) !== (expected === 'pass'))
    pending.set(check.id, failedObservation(scope, check, check.status, expected));
}

/** Retain the failed operation's expectation and diagnostic for its caller. */
function failedObservation(
  scope: StewardScope,
  check: CheckResult,
  status: number,
  expected: NonNullable<StewardScope['expected']>,
): StewardCheckFailure {
  return { activity: scope.activity, id: check.id, expected, status, log: check.log };
}

/** Preserve a corrected pass prediction while retaining prior operation expectations. */
function expectedObservation(
  scope: StewardScope,
  id: string,
  prior: StewardCheckFailure | undefined,
  observed: StewardScope,
) {
  const correctsPrediction =
    scope.activity === 'testing' &&
    id === 'owner-tests' &&
    prior?.expected === 'fail' &&
    observed.expected === 'pass';
  return correctsPrediction ? observed.expected : (prior?.expected ?? observed.expected);
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
