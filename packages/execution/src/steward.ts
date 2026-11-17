import { team } from '../../team/src/index.js';
import type { Agent } from '../../agent/src/index.js';
import type { Milestone, StewardCheckFailure } from '../../direction/src/index.js';
import type { ActivityOutcome, TaskSession } from '../../workflow/src/index.js';
import { hostTask } from './index.js';
import { citedAssemblyChecks, correctionFinding } from './correction.js';
import type { CheckResult } from './check.js';
import { materializeEdits } from './formatter.js';
import { StaleCheckedEdit } from './edits.js';
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
  const assignment = await stewardAssignment(task, milestone, scope, correction, signal);
  const result = await requestSteward(task, agent, milestone, scope, signal, assignment);
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
  signal: AbortSignal,
  assignment: Awaited<ReturnType<typeof stewardAssignment>>,
): Promise<StewardResult> {
  let diagnostic: string | undefined;
  while (true) {
    try {
      const reply = await askSteward(task, agent, milestone, scope, assignment, signal, diagnostic);
      signal.throwIfAborted();
      const result = decodeSteward(reply, stewardOperations(task, scope), assignment.failedCheck);
      if (result.kind === 'completed') await applyStewardEdits(task, scope, result, signal);
      return result;
    } catch (error) {
      if (!repairableReply(error)) throw error;
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

/** Restrict retries to rejected replies with no checked edits applied. */
function repairableReply(error: unknown): error is Error {
  return (
    error instanceof StewardResponseError ||
    error instanceof InvalidCodexResponse ||
    error instanceof StaleCheckedEdit
  );
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
  assignment: Awaited<ReturnType<typeof stewardAssignment>>,
  signal: AbortSignal,
  responseRepair?: string,
): Promise<unknown> {
  return task.activate(
    agent,
    { component: scope.owner, activity: scope.activity },
    {
      assignment: { ...assignment, ...(responseRepair ? { responseRepair } : {}) },
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

/** Attach the recorded reason a correction was scheduled, alongside any required recheck. */
async function stewardAssignment(
  task: ReturnType<typeof hostTask>,
  milestone: Milestone,
  scope: StewardScope,
  failedCheck: StewardCheckFailure | undefined,
  signal: AbortSignal,
) {
  const finding = correctionFinding(task.history(), milestone);
  const currentChecks: CheckResult[] = [];
  const ownerCheck =
    finding || scope.activity === 'review'
      ? task.ownerReviewChecks().findLast(({ scope: observed }) => observed.owner === scope.owner)
      : undefined;
  if (finding && ['implementation', 'review'].includes(scope.activity)) {
    const acceptance = task.capture.project.checks?.acceptance ?? [];
    for (const id of citedAssemblyChecks(task.observations(), finding, acceptance))
      currentChecks.push(await task.check(id, signal));
  }
  return {
    ...responseShape(milestone.id, scope.activity !== 'review' && Boolean(task.formatPreview)),
    ...(finding ? { finding } : {}),
    ...(failedCheck ? { failedCheck, correction: correctionInstruction } : {}),
    ...(currentChecks.length ? { currentChecks } : {}),
    ...(ownerCheck ? { ownerCheck } : {}),
  };
}

/** Describe the bounded steward responses carried by the task prompt. */
function responseShape(milestone: string, formatter: boolean) {
  return {
    instructions:
      'Return exactly one JSON object with kind at the top level. Choose one of the flat response examples. For completed, edits and checks are separate top-level arrays, even when empty. An operation belongs only in checks. When finding is present, address the exact diagnosis and paths that still need correction. The currentChecks field carries the latest host results when available. Use their logs to distinguish remaining failures from older reports. The ownerCheck field reports the latest host operation for this owner. Its candidate and operation fields identify a clean checkpoint and its captured operation definition when available. The recorded checks run in a networkless overlay. Independent review receives the same host observations. Ordinary assembled verification runs after steward review. Complete review when the work meets engineering acceptance and only that later verification remains. Do not redo fixes already confirmed by a current passing check. When responseRepair is present, read the previous reply in the retained transcript and correct the specific error. Copy a reported current sha256 exactly into expected for that file. Use at most one edit per path. To substitute text and format the same file, put both in one transform. For a small change in an existing file, use transform instead of content so the host computes the replacement bytes. The checkout is read-only; the host applies eligible edits and runs declared checks.',
    transforms: transformShape(formatter),
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

/** Show the compact edit form that can combine a replacement and confined formatting. */
function transformShape(formatter: boolean) {
  return {
    path: 'owned existing file path',
    expected: 'sha256sum of current bytes',
    transform: {
      replace: { before: 'exact unique text', after: 'replacement or empty string' },
      ...(formatter ? { format: true } : {}),
    },
    instructions: 'Include replace, format, or both. Formatting alone uses {"format":true}.',
  };
}

/** Materialize and validate the complete edit batch before its first write. */
async function applyStewardEdits(
  task: ReturnType<typeof hostTask>,
  scope: StewardScope,
  result: Extract<StewardResult, { kind: 'completed' }>,
  signal: AbortSignal,
) {
  if (!result.edits.length) return;
  if (scope.activity === 'review') throw new Error('Checked edits are unavailable during review');
  const edits = await materializeEdits(task, scope.owner, result.edits, signal);
  task.edits(scope.owner, scope.activity, edits);
}

/** Run the requested checks and stop at the first unexpected result. */
async function perform(
  task: ReturnType<typeof hostTask>,
  scope: StewardScope,
  result: Extract<StewardResult, { kind: 'completed' }>,
  correction: StewardCheckFailure | undefined,
  signal: AbortSignal,
): Promise<StewardCheckFailure | undefined> {
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
