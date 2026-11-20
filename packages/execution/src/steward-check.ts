import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Feedback, StewardCheckFailure } from '../../direction/src/index.js';
import type { CheckResult } from './check.js';
import type { HostTask } from './index.js';
import { establishedTestingRed } from './testing-red.js';
import type { Clarification } from './clarifications.js';
import type { ResearchResult } from './research.js';

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
  checkExpectationRepair?: {
    scope: StewardScope;
    id: string;
    log: string;
    expected?: 'pass' | 'fail';
    redLog?: string;
  };
  edits?: readonly { path: string; before: string | null; after: string | null }[];
}

interface AnswerEvent {
  clarification?: Clarification;
  researchResult?: ResearchResult;
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
    const repair = event.checkExpectationRepair;
    const prior = repair && pending.get(repair.id);
    if (
      repair?.scope.owner === scope.owner &&
      repair.scope.activity === scope.activity &&
      prior?.log === repair.log &&
      ((prior.expected === 'fail' && prior.status === 0 && !repair.redLog) ||
        (prior.expected === 'pass' &&
          prior.status > 0 &&
          repair.expected === 'fail' &&
          repair.redLog))
    )
      pending.set(repair.id, { ...prior, expected: repair.expected ?? 'pass' });
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
  const expected = pending.get(check.id)?.expected ?? observed.expected;
  if (!expected) return;
  pending.delete(check.id);
  if (check.prerequisite || check.diagnostic || (check.status === 0) !== (expected === 'pass'))
    pending.set(check.id, {
      activity: scope.activity,
      id: check.id,
      expected,
      status: check.status,
      log: check.log,
      ...(check.diagnostic ? { diagnostic: check.diagnostic } : {}),
    });
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
export function correctionMadeProgress(
  events: readonly unknown[],
  log: string,
  paths?: readonly string[],
) {
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

/** Include completed caller knowledge without treating repeated answers or artifacts as progress. */
export function stewardReplyInput(events: readonly unknown[]) {
  const answers = new Set<string>();
  for (const { clarification, researchResult } of events as readonly AnswerEvent[]) {
    if (clarification?.answer !== undefined)
      answers.add(
        JSON.stringify([
          'clarification',
          clarification.scope,
          clarification.question,
          clarification.answer,
        ]),
      );
    if (researchResult)
      answers.add(
        JSON.stringify([
          'research',
          researchResult.request.id,
          researchResult.digest,
          researchResult.unavailable,
        ]),
      );
  }
  return createHash('sha256')
    .update(JSON.stringify([stewardInput(events), [...answers].sort()]))
    .digest('hex');
}

/** Correct a prediction against actual evidence, retaining every required recheck and original result. */
export function repairCheckExpectation(task: HostTask, id: string, scope: StewardScope) {
  const pending = pendingStewardCheck(task.observations(), scope, id);
  if (!pending || pending.expected === scope.expected) return;
  const redLog =
    scope.expected === 'fail' ? establishedTestingRed(task, scope, pending) : undefined;
  const unexpectedPass =
    scope.expected === 'pass' && pending.expected === 'fail' && pending.status === 0;
  if (!unexpectedPass && !redLog)
    throw new Error(`Cannot change the required recheck for ${id}: expected ${pending.expected}`);
  task.note({
    checkExpectationRepair: {
      scope,
      id,
      log: pending.log,
      expected: scope.expected,
      ...(redLog ? { redLog } : {}),
    },
  });
}
