import type { Agent } from '../../agent/src/index.js';
import type { Milestone, StewardCheckFailure } from '../../direction/src/index.js';
import type { ActivityOutcome, TaskSession } from '../../workflow/src/index.js';
import { hostTask } from './index.js';
import type { CheckedEdit } from './edits.js';
import type { StewardScope } from './steward-check.js';

type CheckRequest = Pick<StewardCheckFailure, 'id' | 'expected'>;

type StewardResult =
  | { kind: 'completed'; edits: CheckedEdit[]; checks: CheckRequest[] }
  | Exclude<ActivityOutcome, { kind: 'completed' }>;

const correctionInstruction =
  'Read the retained check log, correct the current worktree with checked edits, and preserve prior work. The host reruns the original check with its original expectation.';

/** Run one Steward Agent activity and perform only the checked actions it requested. */
export async function steward(
  agent: Agent,
  session: TaskSession,
  milestone: Milestone,
  activity: StewardScope['activity'],
  signal: AbortSignal,
): Promise<ActivityOutcome> {
  const task = hostTask(session);
  await task.workspace(signal);
  const before = task.evidence.length;
  const scope = { owner: milestone.owner, activity };
  const correction = task.pendingCheck(scope);
  const result = await askSteward(task, agent, milestone, scope, correction, signal);
  signal.throwIfAborted();
  validateStewardResult(result);
  if (result.kind !== 'completed') return stewardOutcome(result, task.evidence.slice(before));
  const failed = await perform(task, scope, result, correction, signal);
  const evidence = task.evidence.slice(before);
  return failed
    ? stewardCheckOutcome(milestone, failed, correction, evidence)
    : { kind: 'completed', evidence };
}

/** Route the first failure to Direction and stop if its required recheck still fails. */
function stewardCheckOutcome(
  milestone: Milestone,
  failed: StewardCheckFailure,
  correction: StewardCheckFailure | undefined,
  evidence: readonly string[],
): ActivityOutcome {
  const reason = `Operation ${failed.id} exited ${failed.status}; expected ${failed.expected}; evidence: ${failed.log}`;
  if (correction?.id === failed.id)
    return { kind: 'blocked', reason, evidence: [correction.log, ...evidence] };
  return {
    kind: 'supplier',
    owner: milestone.owner,
    milestone: milestone.id,
    reason,
    failedCheck: failed,
    evidence,
  };
}

/** Give the owner its exact failing check and log when activating correction work. */
async function askSteward(
  task: ReturnType<typeof hostTask>,
  agent: Agent,
  milestone: Milestone,
  scope: StewardScope,
  failedCheck: StewardCheckFailure | undefined,
  signal: AbortSignal,
): Promise<StewardResult> {
  const diagnosis = failedCheck ? { failedCheck, correction: correctionInstruction } : {};
  return task.activate(
    agent,
    { component: scope.owner, activity: scope.activity },
    {
      assignment: { ...responseShape(milestone.id), ...diagnosis },
      milestone: {
        id: milestone.id,
        step: milestone.steps.find((step) => step.activity === scope.activity),
      },
      acceptance: milestone.criteria,
      evidence: task.evidence.slice(),
    },
    signal,
  ) as Promise<StewardResult>;
}

/** Keep native check failures host-authored when forwarding a model's response. */
function stewardOutcome(
  result: Exclude<StewardResult, { kind: 'completed' }>,
  evidence: readonly string[],
): ActivityOutcome {
  if (result.kind !== 'supplier') return { ...result, evidence };
  const { kind, milestone, owner, reason } = result;
  return { kind, milestone, owner, reason, evidence };
}

/** Refuse unexpected outcomes before acting on the steward response. */
function validateStewardResult(result: StewardResult) {
  if (!result || !['completed', 'supplier', 'question', 'blocked'].includes(result.kind))
    throw new Error('The steward returned an unsupported outcome');
}

/** Describe the bounded steward responses carried by the task prompt. */
function responseShape(milestone: string) {
  return {
    instructions:
      'Read the checkout and return one JSON object without code fences. The checkout is read-only. The host applies eligible edits and runs declared checks.',
    completed: {
      kind: 'completed',
      edits: [
        {
          path: 'owned path relative to the project',
          expected: 'sha256sum of current bytes or null for a new file',
          content: 'entire replacement text or null for deletion',
        },
      ],
      checks: [{ id: 'declared operation', expected: 'pass or fail for expected-red work' }],
    },
    supplier: {
      kind: 'supplier',
      milestone: `Existing supplier milestone ID when linking prior work, otherwise ${milestone}`,
      owner: 'supplier component ID',
      reason: 'required contribution',
      evidence: [],
    },
    question: { kind: 'question', question: 'genuine human decision required', evidence: [] },
  };
}

/** Apply checked edits and stop at the first unexpected operation result. */
async function perform(
  task: ReturnType<typeof hostTask>,
  scope: StewardScope,
  result: Extract<StewardResult, { kind: 'completed' }>,
  correction: StewardCheckFailure | undefined,
  signal: AbortSignal,
): Promise<StewardCheckFailure | undefined> {
  const allowed =
    task.capture.components[scope.owner]?.activities[scope.activity]?.operations ?? [];
  const checks = checkedOperations(result, allowed, correction);
  if (result.edits.length) task.edits(scope.owner, scope.activity, result.edits);
  for (const { id, expected } of checks) {
    const check = await task.check(id, signal, scope);
    signal.throwIfAborted();
    if (check.status === 'not-applicable' && expected === 'pass' && id !== correction?.id) continue;
    if (typeof check.status !== 'number')
      throw new Error(
        `Operation ${id} reported ${check.status}; expected ${expected}; evidence: ${check.log}`,
      );
    if ((check.status === 0) !== (expected === 'pass'))
      return { id, expected, status: check.status, log: check.log, activity: scope.activity };
  }
}

/** Validate the steward's requests and keep a correction's original check mandatory. */
function checkedOperations(
  result: Extract<StewardResult, { kind: 'completed' }>,
  allowed: readonly string[],
  correction?: StewardCheckFailure,
): CheckRequest[] {
  if (
    !Array.isArray(result.edits) ||
    !Array.isArray(result.checks) ||
    result.checks.some(
      ({ id, expected }) => !allowed.includes(id) || !['pass', 'fail'].includes(expected),
    )
  )
    throw new Error('The steward requested an unavailable edit or operation');
  if (!correction) return result.checks;
  if (
    !allowed.includes(correction.id) ||
    result.checks.some(
      ({ id, expected }) => id === correction.id && expected !== correction.expected,
    )
  )
    throw new Error(`Cannot change the required recheck for ${correction.id}`);
  return [correction, ...result.checks.filter(({ id }) => id !== correction.id)];
}
