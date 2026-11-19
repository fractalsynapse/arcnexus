import { team } from '../../team/src/index.js';
import { InvalidAgentResponse, type Agent } from '../../agent/src/index.js';
import type { Milestone, StewardCheckFailure } from '../../direction/src/index.js';
import {
  localRepairIndex,
  type ActivityOutcome,
  type TaskSession,
} from '../../workflow/src/index.js';
import { hostTask, type HostTask } from './index.js';
import { citedAssemblyChecks, correctionFinding } from './correction.js';
import type { CheckResult } from './check.js';
import type { ContextRefresh } from './activation.js';
import { archiveResearch, pendingResearch } from './research-archive.js';
import { materializeEdits } from './formatter.js';
import { CheckedEditOwnershipRefusal, StaleCheckedEdit } from './edits.js';
import { InvalidCodexResponse } from './codex.js';
import {
  checkFailureSignature,
  correctionMadeProgress,
  stewardInput,
  type StewardScope,
} from './steward-check.js';
import { decodeSteward, StewardResponseError, type StewardResult } from './steward-response.js';
import { supplierAnswerRequired, supplierContext } from './supplier-context.js';
import { stewardProgress } from './steward-progress.js';
import { retainedTesting } from './testing-rewind.js';
import { establishedTestingRed } from './testing-red.js';
import { retainedEvidence } from './context-evidence.js';

const correctionInstruction =
  'Read failedCheck.log first. It is the latest observed failure. Preserve the earlier finding as history. Correct the current failure within the accepted milestone, or request a distinct contribution through Direction when new work is needed. The host reruns the original check with its original expectation.';

/** Distinguish a caller's mistaken prediction from an actual failing required-pass operation. */
function checkRepairInstruction(task: HostTask, scope: StewardScope, failed: StewardCheckFailure) {
  const redLog = establishedTestingRed(task, scope, failed);
  if (redLog)
    return `Read failedCheck.log and established red ${redLog ?? failed.log}. If your passing prediction was mistaken, call the same check with expected fail. The host requires matching actual negative evidence under the same milestone and a fresh recheck. Finish Testing's checklist; Implementation and assembled checks must still pass. Do not ask for a forward local rewind or weaken acceptance.`;
  if (failed.expected === 'fail' && failed.status === 0)
    return 'Read failedCheck.log: the actual check passed while you predicted failure. If that prediction was mistaken for this activity, call the same check with expected pass. The host retains the original request/result and requires a current passing recheck. Do not break working code or manufacture a failing assertion. If a relevant new negative regression is required by the goal, retain its actual evidence. Captured acceptance is unchanged.';
  if (failed.status === 0)
    return 'A current passing recheck remains pending after an interrupted prediction correction. The earlier pass is retained as evidence; it does not establish a code defect. Run the same check with expected pass, or allow the host to reconcile that required recheck. Captured acceptance is unchanged.';
  return correctionInstruction;
}

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
  const result = await requestSteward(task, agent, milestone, scope, signal);
  if (result.kind !== 'completed')
    return {
      ...result,
      evidence: task.evidence.slice(before),
      ...(result.kind === 'repair' ? { input: stewardInput(task.observations()) } : {}),
    };
  const failed =
    (await perform(task, scope, result, correction, signal)) ??
    (await reconcileCheck(task, scope, correction, signal));
  const evidence = task.evidence.slice(before);
  return failed
    ? stewardCheckOutcome(task, failed, correction, evidence)
    : { kind: 'completed', evidence, ...(result.answer ? { answer: result.answer } : {}) };
}

/** Return failed checks to their caller and hold unchanged failures without new progress. */
function stewardCheckOutcome(
  task: HostTask,
  failed: StewardCheckFailure,
  correction: StewardCheckFailure | undefined,
  evidence: readonly string[],
): ActivityOutcome {
  const reason = `Operation ${failed.id} exited ${failed.status}; expected ${failed.expected}`;
  if (correction?.id === failed.id && !correctionMadeProgress(task.observations(), correction.log))
    return {
      kind: 'blocked',
      reason,
      failedCheck: failed,
      evidence: [correction.log, ...evidence],
    };
  return {
    kind: 'repair',
    activity: failed.activity === 'review' ? 'implementation' : failed.activity,
    input: `${stewardInput(task.observations())}:${checkFailureSignature(failed.log)}`,
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
): Promise<StewardResult> {
  let diagnostic: string | undefined;
  const seen = new Set<string>();
  while (true) {
    try {
      const assignment = await stewardAssignment(task, milestone, scope, signal);
      const reply = await askSteward(task, agent, milestone, scope, assignment, signal, diagnostic);
      signal.throwIfAborted();
      return await applyStewardReply(task, scope, reply, assignment, signal, milestone);
    } catch (error) {
      if (!repairableReply(error)) throw error;
      signal.throwIfAborted();
      if (seen.has(replyRepairIdentity(error, task)))
        return {
          kind: 'blocked',
          reason: `Steward reply repair failed: ${error.message}`,
          evidence: [],
        };
      diagnostic = error.message;
      seen.add(replyRepairIdentity(error, task));
      task.note({ stewardRepair: { scope, diagnostic, evidence: task.evidence.at(-1) } });
    }
  }
}

/** Match a rejected reply class against checked progress rather than repeated prose. */
function replyRepairIdentity(error: Error, task: HostTask) {
  const finding = error instanceof InvalidAgentResponse ? error.identity : error.message;
  return JSON.stringify([finding, stewardInput(task.observations())]);
}

/** Restrict retries to rejected replies with no checked edits applied. */
function repairableReply(error: unknown): error is Error {
  return (
    error instanceof StewardResponseError ||
    error instanceof InvalidCodexResponse ||
    error instanceof StaleCheckedEdit ||
    error instanceof CheckedEditOwnershipRefusal
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
      assignment: {
        ...assignment,
        ...archiveContext(task, scope),
        ...(responseRepair ? { responseRepair } : {}),
      },
      milestone: {
        id: milestone.id,
        step: milestone.steps.find((step) => step.activity === scope.activity),
      },
      acceptance: milestone.criteria,
      evidence: retainedEvidence(task, [task.pendingCheck(scope)?.log]),
    },
    signal,
    stewardContinuation(task, milestone, scope, signal),
  );
}

/** Reuse the canonical caller builder after research or clarification without losing complete answers. */
function stewardContinuation(
  task: HostTask,
  milestone: Milestone,
  scope: StewardScope,
  signal: AbortSignal,
): ContextRefresh {
  return async (input) => ({
    ...input,
    assignment: {
      ...(input.assignment as Record<string, unknown>),
      ...(await stewardAssignment(task, milestone, scope, signal)),
      ...archiveContext(task, scope),
    },
    evidence: retainedEvidence(task, [task.pendingCheck(scope)?.log]),
  });
}

/** Offer the editable steward a checked path for archiving reusable reports. */
function archiveContext(task: ReturnType<typeof hostTask>, scope: StewardScope) {
  if (scope.activity === 'review') return {};
  const reports = pendingResearch(task, scope.owner);
  return {
    researchArchive: {
      instructions:
        'Use archive-research with the report ID to retain a reusable report through a single checked edit.',
      reports,
    },
  };
}

/** Attach the recorded reason a correction was scheduled, alongside any required recheck. */
async function stewardAssignment(
  task: ReturnType<typeof hostTask>,
  milestone: Milestone,
  scope: StewardScope,
  signal: AbortSignal,
) {
  const finding = correctionFinding(task.history(), milestone);
  const failedCheck = task.pendingCheck(scope);
  return {
    ...responseShape(scope.activity !== 'review' && Boolean(task.formatPreview)),
    ...supplierContext(task.history(), milestone.id),
    ...stewardProgress(task.history(), milestone),
    retainedTesting: retainedTesting(task, scope),
    inbox: task.inbox,
    answerRequired:
      task.inbox?.owner === milestone.owner ||
      supplierAnswerRequired(task.history(), milestone, scope.activity),
    ...(finding ? { finding } : {}),
    failedCheck,
    correction: failedCheck ? checkRepairInstruction(task, scope, failedCheck) : undefined,
    ...(await correctionChecks(task, scope, finding, signal)),
  };
}

/** Refresh checks cited by a final rejection and attach the latest applicable owner observation. */
async function correctionChecks(
  task: HostTask,
  scope: StewardScope,
  finding: ReturnType<typeof correctionFinding>,
  signal: AbortSignal,
) {
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
    currentChecks,
    ownerCheck,
  };
}

/** Describe the bounded steward responses carried by the task prompt. */
function responseShape(formatter: boolean) {
  return {
    repair:
      'Repair tool and check failures within this milestone. For a self-review finding return kind repair, activity documentation, testing or implementation, and the exact reason; choose the earliest affected applicable activity. If localRepair is present, read its diagnostic. When targetCompleted is true, that target already finished; continue the current activity using its results. Completed Testing with a satisfied expected-fail check is valid retained red evidence. A rewind does not require reproducing it against the implemented candidate. For behavior-preserving corrections, characterize with expected pass. If you mistakenly predicted failure but the actual check passed, correct the prediction with expected pass through the same tool. The host retains the original observation and requires a current passing recheck; this neither invents red nor changes goal acceptance. Add new red only for a relevant new behavioral regression. completedActivities comes from the host cursor. Absence of localRepair is normal initially. Request a supplier only for distinct work requiring another responsibility. Return blocked only for an unavailable prerequisite, not for an ordinary repairable defect.',
    instructions:
      'Unfinished assigned work is not a blocked outcome: continue the current activity with mapped operations until its checklist is met. Request optional research for missing knowledge. Do not return blocked or a self-repair merely as a progress report. Historical evidence is supplied through a complete readable index; use mapped read-file and nextOffset to retrieve relevant observations. Current diagnostics and accepted criteria are authoritative. Use the mapped local MCP tools for project reads, checked edits and owner checks. The read-only filesystem is deliberate. Make authorized changes through the mapped checked-edit MCP tool even when direct writes are unavailable. Attempt that operation for an owned path before reporting that edits are blocked, and report any exact refusal. A successful edit is already recorded. Mapped checks execute during the MCP call and return their actual status and log. Read that result, correct an ordinary defect locally and recheck without weakening a required-pass check. These tools govern this activation; authored product code may use declared public APIs. Put any narration in summary and omit checks from your reply. If another edit is refused, correct the call or request a distinct supplier contribution. Link its accepted milestone when known, or give the new contribution its own ID. End with one JSON object with kind completed, or kind blocked with a reason. Include answer in a completed response when answering a supplier question. Read retained evidence with read-file. Checks in currentChecks are host-managed. Preserve accepted work when correcting a diagnostic. Only the host performs assembled verification and delivery.',
    requests: { formatAvailable: formatter },
  };
}

/** Validate the reply and its complete edit batch before applying any writes. */
async function applyStewardReply(
  task: ReturnType<typeof hostTask>,
  scope: StewardScope,
  reply: unknown,
  assignment: Awaited<ReturnType<typeof stewardAssignment>>,
  signal: AbortSignal,
  milestone: Milestone,
) {
  const hostChecks = assignment.currentChecks?.map(({ id }) => id);
  const result = decodeSteward(
    reply,
    stewardOperations(task, scope),
    assignment.failedCheck,
    hostChecks,
  );
  validateRepairTarget(task, milestone, scope, result);
  if (result.kind === 'completed' && assignment.answerRequired && !result.answer)
    throw new StewardResponseError(
      'Include the complete response to the supplied question in answer.',
    );
  if (result.kind !== 'completed' || (!result.edits.length && !result.archiveResearch?.length))
    return result;
  if (scope.activity === 'review') throw new Error('Checked edits are unavailable during review');
  const edits = await materializeEdits(task, scope.owner, result.edits, signal);
  edits.push(...archiveResearch(task, scope.owner, result.archiveResearch ?? []));
  if (edits.length) task.edits(scope.owner, scope.activity, edits);
  return result;
}

/** Return an unavailable model target to its caller before Workflow records an activation. */
function validateRepairTarget(
  task: HostTask,
  milestone: Milestone,
  scope: StewardScope,
  result: StewardResult,
) {
  if (result.kind !== 'repair') return;
  const from = milestone.steps.findIndex(({ activity }) => activity === scope.activity);
  if (localRepairIndex(task.capture, milestone, from, result.activity) !== undefined) return;
  const available = milestone.steps
    .filter(
      ({ activity }) => localRepairIndex(task.capture, milestone, from, activity) !== undefined,
    )
    .map(({ activity }) => activity);
  throw new StewardResponseError(
    `Unavailable local repair: ${scope.owner}/${result.activity}; available rewind targets: ${available.join(', ') || 'none'}. Finish the current activity; do not jump forward or skip an incomplete Step.`,
  );
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
    const check = await task.check(id, signal, { ...scope, expected });
    signal.throwIfAborted();
    if (check.status === 'not-applicable' && expected === 'pass' && id !== correction?.id) continue;
    if (typeof check.status !== 'number')
      throw new Error(
        `Operation ${id} reported ${check.status}; expected ${expected}; evidence: ${check.log}`,
      );
    if (check.prerequisite || (check.status === 0) !== (expected === 'pass'))
      return { id, expected, status: check.status, log: check.log, activity: scope.activity };
  }
}

/** Recheck retained obligations or changed inputs, preserving a fresh unchanged caller diagnostic. */
async function reconcileCheck(
  task: HostTask,
  scope: StewardScope,
  correction: StewardCheckFailure | undefined,
  signal: AbortSignal,
) {
  const pending = task.pendingCheck(scope);
  if (
    pending &&
    (pending.log === correction?.log || correctionMadeProgress(task.observations(), pending.log))
  ) {
    const result = await perform(
      task,
      scope,
      { kind: 'completed', edits: [], checks: [pending] },
      pending,
      signal,
    );
    if (result) return result;
  }
  return task.pendingCheck(scope);
}
