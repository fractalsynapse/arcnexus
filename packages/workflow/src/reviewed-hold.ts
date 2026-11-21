import { editFingerprint, HostTask, type HoldContext } from '../../execution/src/index.js';
import type { RevisionFeedback } from '../../direction/src/index.js';
import {
  stopped,
  type ActivityCheckpoint,
  type TaskSession,
  type TaskOutcome,
} from './services.js';

/** Route retained independent-review corrections without turning genuine prerequisites into work. */
export function reviewedHold(
  session: TaskSession,
  activation: ActivityCheckpoint,
  revise: (feedback: RevisionFeedback) => Promise<TaskOutcome | undefined>,
) {
  const outcome = activation.outcome;
  if (outcome.kind !== 'blocked' || !outcome.holdContext)
    return stopped(
      'blocked',
      outcome.kind === 'blocked' ? outcome.reason : 'Expected a hold',
      outcome.evidence,
    );
  const held = outcome.holdContext;
  if (held.prerequisite && !held.prerequisite.satisfied)
    return stopped('blocked', held.prerequisite.requiredAction, outcome.evidence);
  const events = session.history?.() ?? [];
  const previous = events.findLastIndex(
    (event) => 'reviewedHold' in event && sameHold(event.reviewedHold, held),
  );
  if (previous >= 0 && events.slice(previous + 1).some((event) => 'plan' in event))
    return stopped('blocked', unresolvedHold(held), outcome.evidence);
  if (previous < 0) session.record({ reviewedHold: held });
  return revise(holdFeedback(held, activation));
}

/** Re-enter the retained caller when secured relevant bytes or a resolved check supersede its hold. */
export function supersededReviewedHold(session: TaskSession, activation: ActivityCheckpoint) {
  const outcome = activation.outcome;
  const held = outcome.kind === 'blocked' ? outcome.holdContext : undefined;
  if (!(session instanceof HostTask) || !held || held.prerequisite) return false;
  if (
    held.task.id !== session.taskID ||
    held.task.authority !== session.capture.source.revision ||
    !session.worktree
  )
    return false;
  const receipts = session.observations<{
    editReceipt?: HoldContext['receipts'][number];
    checkpoint?: { head: string };
  }>();
  const changed = held.progress.inputs.some(({ path, digest }) =>
    receipts.some(({ editReceipt, checkpoint }) =>
      Boolean(
        checkpoint &&
        editReceipt?.path === path &&
        editReceipt.after !== digest &&
        editReceipt.after ===
          editFingerprint(session.worktree!, session.capture, activation.owner, path),
      ),
    ),
  );
  return (
    changed ||
    observedHeldCheckProgress(session, activation, held) ||
    observedHeldKnowledgeProgress(session, activation, held)
  );
}

/** Re-enter Execution for newer scoped findings; its canonical hold identity still rejects repetition. */
function observedHeldCheckProgress(
  task: HostTask,
  activation: ActivityCheckpoint,
  held: HoldContext,
) {
  const check = held.failure.check;
  if (!check) return false;
  const scope = { owner: activation.owner, activity: activation.step };
  const latest = task
    .observations<{
      check?: typeof check;
      scope?: typeof scope;
    }>()
    .findLast(
      (event) =>
        event.check?.id === check.id &&
        event.scope?.owner === scope.owner &&
        event.scope.activity === scope.activity,
    )?.check;
  if (!latest || latest.log === check.log) return false;
  const pending = task.pendingCheck(scope);
  if (latest.status === 0) return !pending;
  return Boolean(
    !latest.prerequisite &&
    pending?.log === latest.log &&
    pending.diagnostic &&
    pending.diagnostic !== held.failure.diagnostic,
  );
}

/** Compare completed inbox content, never new artifact names or unrelated caller knowledge. */
function observedHeldKnowledgeProgress(
  task: HostTask,
  activation: ActivityCheckpoint,
  held: HoldContext,
) {
  const scopes = heldKnowledgeScopes(task, activation, held);
  const answers = new Map<string, HoldContext['answers'][number]>();
  const research = new Map<string, HoldContext['research'][number]>();
  for (const { clarification, researchResult } of task.observations<{
    clarification?: HoldContext['answers'][number];
    researchResult?: HoldContext['research'][number];
  }>()) {
    if (clarification && scopes.includes(clarification.scope))
      answers.set(clarification.question, clarification);
    if (researchResult && scopes.includes(researchResult.request.inbox))
      research.set(researchResult.request.id, researchResult);
  }
  return (
    knowledgeContent([...answers.values()], [...research.values()]) !==
    knowledgeContent(held.answers, held.research)
  );
}

/** Resolve both host conversations and prepared activations through Execution's durable inbox boundary. */
function heldKnowledgeScopes(task: HostTask, activation: ActivityCheckpoint, held: HoldContext) {
  const selection = { component: activation.owner, activity: activation.step };
  const data = { milestone: { id: held.milestone }, acceptance: held.acceptance };
  const plan = task.history().findLast((event) => 'plan' in event)?.plan;
  const step = plan?.milestones
    .find((milestone) => milestone.id === held.milestone)
    ?.steps.find((step) => step.activity === activation.step);
  return [
    task.inboxScope(selection, data),
    task.inboxScope(selection, { ...data, milestone: { ...data.milestone, step } }),
  ];
}

/** Exclude incomplete questions and duplicate evidence while preserving complete answer bytes. */
function knowledgeContent(answers: HoldContext['answers'], research: HoldContext['research']) {
  const entries = [
    ...answers
      .filter((answer) => answer.answer !== undefined)
      .map(({ scope, question, answer }) =>
        JSON.stringify(['clarification', scope, question, answer]),
      ),
    ...research.map(({ request, digest, unavailable }) =>
      JSON.stringify(['research', request.id, digest, unavailable]),
    ),
  ];
  return JSON.stringify([...new Set(entries)].sort());
}

/** Compare host-observed relevant inputs and finding, excluding incidental artifact allocation. */
function sameHold(previous: HoldContext, current: HoldContext) {
  return (
    previous.milestone === current.milestone &&
    previous.activity === current.activity &&
    previous.progress.identity === current.progress.identity
  );
}

/** Preserve an actionable original criterion and exact diagnostic when correction made no progress. */
function unresolvedHold(held: HoldContext) {
  const criteria = held.rejection.findings.map((finding) => finding.criterion).join(', ');
  return `Unresolved criteria ${criteria}: ${held.failure.diagnostic}. Required next action: correct the retained finding or supply new relevant checked evidence before continuing.`;
}

/** Reuse Direction's native explicit correction route with the exact observed check or edit evidence. */
function holdFeedback(
  held: HoldContext,
  activation: ActivityCheckpoint,
): Extract<RevisionFeedback, { kind: 'supplier' }> {
  const check = held.failure.check;
  return {
    kind: 'supplier',
    owner: activation.owner,
    milestone: activation.milestone,
    requester: activation.milestone,
    reason: held.failure.diagnostic,
    evidence: [...new Set([...activation.outcome.evidence, ...(check ? [check.log] : [])])],
    ...(check && typeof check.status === 'number'
      ? {
          failedCheck: {
            id: check.id,
            activity: held.activity,
            expected: held.failure.expected ?? 'pass',
            status: check.status,
            log: check.log,
            diagnostic: held.failure.diagnostic,
          },
        }
      : {}),
  };
}
