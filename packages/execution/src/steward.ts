import { team } from '../../team/src/index.js';
import type { Agent } from '../../agent/src/index.js';
import type { Milestone, StewardCheckFailure } from '../../direction/src/index.js';
import type { ActivityOutcome, TaskSession } from '../../workflow/src/index.js';
import { hostTask } from './index.js';
import { InvalidCodexResponse } from './codex.js';
import type { StewardScope } from './steward-check.js';
import { decodeSteward, StewardResponseError, type StewardResult } from './steward-response.js';

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
  if (!task.worktree) throw new Error('Steward activation requires a prepared worktree');
  const before = task.evidence.length;
  const scope = { owner: milestone.owner, activity };
  const correction = task.pendingCheck(scope);
  const result = await requestSteward(task, agent, milestone, scope, correction, signal);
  if (result.kind !== 'completed') return { ...result, evidence: task.evidence.slice(before) };
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

/** Repair one invalid reply with the same steward before any requested effects are applied. */
async function requestSteward(
  task: ReturnType<typeof hostTask>,
  agent: Agent,
  milestone: Milestone,
  scope: StewardScope,
  failed: StewardCheckFailure | undefined,
  signal: AbortSignal,
): Promise<StewardResult> {
  const allowed = stewardOperations(task, scope);
  let diagnostic: string | undefined;
  while (true) {
    try {
      const reply = await askSteward(task, agent, milestone, scope, failed, signal, diagnostic);
      signal.throwIfAborted();
      return decodeSteward(reply, allowed, failed);
    } catch (error) {
      if (!(error instanceof StewardResponseError || error instanceof InvalidCodexResponse))
        throw error;
      signal.throwIfAborted();
      if (diagnostic)
        return {
          kind: 'blocked',
          reason: `Steward reply repair failed: ${error.message}`,
          evidence: [],
        };
      diagnostic = error.message;
      task.note({ stewardRepair: { scope, diagnostic, evidence: task.evidence.at(-1) } });
    }
  }
}

/** Resolve operation authority from the captured team member and current activity. */
function stewardOperations(task: ReturnType<typeof hostTask>, scope: StewardScope) {
  return (
    team.list(task.capture.components, { component: scope.owner, activity: scope.activity })[0]
      ?.activities[scope.activity]?.operations ?? []
  );
}

/** Give the owner its exact failing check and log when activating correction work. */
async function askSteward(
  task: ReturnType<typeof hostTask>,
  agent: Agent,
  milestone: Milestone,
  scope: StewardScope,
  failedCheck: StewardCheckFailure | undefined,
  signal: AbortSignal,
  responseRepair?: string,
): Promise<unknown> {
  const diagnosis = failedCheck ? { failedCheck, correction: correctionInstruction } : {};
  return task.activate(
    agent,
    { component: scope.owner, activity: scope.activity },
    {
      assignment: {
        ...responseShape(milestone.id, task.formatPreview?.entry),
        ...diagnosis,
        ...(responseRepair ? { responseRepair } : {}),
      },
      milestone: {
        id: milestone.id,
        step: milestone.steps.find((step) => step.activity === scope.activity),
      },
      acceptance: milestone.criteria,
      evidence: task.evidence.slice(),
    },
    signal,
  );
}

/** Describe the bounded steward responses carried by the task prompt. */
function responseShape(milestone: string, formatter?: string) {
  return {
    instructions:
      'Return exactly one JSON object with kind at the top level. Choose one of the flat response examples. For completed, edits and checks are separate top-level arrays, even when empty. An operation belongs only in checks. When responseRepair is present, read the previous reply in the retained transcript and correct its response shape. When formatPreview is provided, replace its path placeholder and run it without --write to produce formatted contents on stdout. The checkout is read-only; the host applies eligible edits and runs declared checks.',
    ...(formatter ? { formatPreview: ['node', formatter, '<owned path>'] } : {}),
    responses: [
      {
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
      {
        kind: 'supplier',
        milestone: `Existing supplier milestone ID when linking prior work, otherwise ${milestone}`,
        owner: 'supplier component ID',
        reason: 'required contribution',
      },
      { kind: 'question', question: 'genuine human decision required' },
      { kind: 'blocked', reason: 'reason the activity cannot proceed' },
    ],
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
  if (result.edits.length) task.edits(scope.owner, scope.activity, result.edits);
  for (const { id, expected } of result.checks) {
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
