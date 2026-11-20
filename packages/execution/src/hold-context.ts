import type { Milestone, StewardCheckFailure } from '../../direction/src/index.js';
import type { ActivityOutcome } from '../../workflow/src/index.js';
import type { HostTask } from './index.js';
import type { CheckResult } from './check.js';
import type { Clarification } from './clarifications.js';
import type { ObservedEdit } from './edits.js';
import type { ResearchResult } from './research.js';
import { stewardReplyInput, type StewardScope } from './steward-check.js';
import { correctionFeedback } from './correction.js';
import { git } from './git.js';
import { holdProgress } from './hold-progress.js';
import { supplierContext } from './supplier-context.js';

interface Observation {
  check?: CheckResult;
  scope?: StewardScope;
  editReceipt?: ObservedEdit & { id: string };
  checkpoint?: { head: string };
  clarification?: Clarification;
  researchResult?: ResearchResult;
  stewardRepair?: { scope: StewardScope; diagnostic: string; operation?: string };
}

export type HoldContext = NonNullable<ReturnType<typeof retainedHoldContext>>;
export type StewardOutcome = ActivityOutcome & { holdContext?: HoldContext };

/** Attach journal-backed recovery facts only to host holds following an independent rejection. */
export function retainStewardHold(
  task: HostTask,
  milestone: Milestone,
  scope: StewardScope,
  outcome: ActivityOutcome,
): StewardOutcome {
  if (outcome.kind !== 'blocked') return outcome;
  const holdContext = retainedHoldContext(task, milestone, scope, outcome);
  if (!holdContext) return outcome;
  const artifact = task.store('steward-hold.json', JSON.stringify(holdContext, null, 2));
  return { ...outcome, holdContext, evidence: [...outcome.evidence, artifact] };
}

/** Reconstruct complete recovery context from retained events without altering task acceptance. */
function retainedHoldContext(
  task: HostTask,
  milestone: Milestone,
  scope: StewardScope,
  outcome: Extract<ActivityOutcome, { kind: 'blocked' }>,
) {
  const rejection = correctionFeedback(task.history(), milestone);
  if (rejection?.kind !== 'rejection') return;
  const events = task.observations<Observation>();
  const failure = heldFailure(events, scope, outcome);
  const knowledge = holdKnowledge(task, milestone, scope, events);
  return {
    task: taskIdentity(task),
    milestone: milestone.id,
    activity: scope.activity,
    acceptance: milestone.criteria,
    rejection,
    failure,
    ...checkedReceipts(events),
    ...knowledge,
    position: task.history().findLast((event) => 'position' in event)?.position,
    progress: holdProgress(task, milestone, failure.diagnostic, failure.check, knowledge.knowledgeIdentity),
    prerequisite: holdPrerequisite(failure.check, knowledge.gates),
    ...supplierContext(task.history(), milestone.id),
  };
}

/** Keep the engineering base, active authority and locally secured checkpoint distinct. */
function taskIdentity(task: HostTask) {
  return {
    id: task.taskID,
    issue: task.issue,
    branch: task.branch,
    base: task.config.capture.source.revision,
    checkpoint: git(task.worktree!, 'rev-parse', 'HEAD'),
    authority: task.capture.source.revision,
  };
}

/** Pair an unresolved expectation with its exact actual check; reply refusals have no invented exit. */
function heldFailure(
  events: readonly Observation[],
  scope: StewardScope,
  outcome: Extract<ActivityOutcome, { kind: 'blocked' }>,
) {
  const failed: StewardCheckFailure | undefined = outcome.failedCheck;
  const check = failed
    ? events.findLast((event) => event.check?.log === failed.log)?.check
    : undefined;
  const refusal = events.findLast(
    ({ stewardRepair }) =>
      stewardRepair?.scope.owner === scope.owner && stewardRepair.scope.activity === scope.activity,
  )?.stewardRepair;
  return {
    diagnostic: failed?.diagnostic ?? outcome.reason,
    operation: failed?.id ?? refusal?.operation ?? 'steward-response',
    ...(failed ? { expected: failed.expected } : {}),
    check,
  };
}

/** Deduplicate acknowledged effects while retaining their original checkpoint association. */
function checkedReceipts(events: readonly Observation[]) {
  const receipts = new Map<string, NonNullable<Observation['editReceipt']>>();
  const checkpoints = new Map<string, { receipt: string; checkpoint: string }>();
  for (const { editReceipt, checkpoint } of events) {
    if (!editReceipt) continue;
    receipts.set(editReceipt.id, editReceipt);
    if (checkpoint)
      checkpoints.set(editReceipt.id, { receipt: editReceipt.id, checkpoint: checkpoint.head });
  }
  return { receipts: [...receipts.values()], receiptCheckpoints: [...checkpoints.values()] };
}

/** Select complete caller knowledge using the same durable inbox identity as activation. */
function holdKnowledge(
  task: HostTask,
  milestone: Milestone,
  scope: StewardScope,
  events: readonly Observation[],
) {
  const scopes = holdScopes(task, milestone, scope);
  const gates = new Map<string, Clarification>();
  const research = new Map<string, ResearchResult>();
  for (const { clarification, researchResult } of events) {
    if (clarification && scopes.includes(clarification.scope))
      gates.set(clarification.question, clarification);
    if (researchResult && scopes.includes(researchResult.request.inbox))
      research.set(researchResult.request.id, researchResult);
  }
  return {
    answers: [...gates.values()].filter((gate) => gate.answer !== undefined),
    gates: [...gates.values()].filter((gate) => gate.answer === undefined),
    research: [...research.values()],
    knowledgeIdentity: stewardReplyInput([
      ...[...gates.values()].map((clarification) => ({ clarification })),
      ...[...research.values()].map((researchResult) => ({ researchResult })),
    ]),
  };
}

/** Only typed host prerequisite observations or actual unanswered gates establish a prerequisite. */
function holdPrerequisite(check: CheckResult | undefined, gates: readonly Clarification[]) {
  if (check?.prerequisite)
    return {
      kind: check.prerequisite,
      satisfied: false,
      requiredAction: check.reason!,
      evidence: [check.log],
    };
  const gate = gates[0];
  if (gate)
    return {
      kind: 'human-decision',
      satisfied: false,
      requiredAction: gate.question,
      evidence: gate.evidence ? [gate.evidence] : [],
    };
}

/** Match both direct host conversations and the complete prepared steward assignment. */
function holdScopes(task: HostTask, milestone: Milestone, scope: StewardScope) {
  const selection = { component: scope.owner, activity: scope.activity };
  const data = { milestone: { id: milestone.id }, acceptance: milestone.criteria };
  return [
    task.inboxScope(selection, data),
    task.inboxScope(selection, {
      ...data,
      milestone: {
        ...data.milestone,
        step: milestone.steps.find((s) => s.activity === scope.activity),
      },
    }),
  ];
}

/** Apply the same relevant secured input and completed knowledge comparison to refused replies. */
export function reviewedReplyInput(task: HostTask, milestone: Milestone, scope: StewardScope) {
  const knowledge = holdKnowledge(task, milestone, scope, task.observations());
  return holdProgress(task, milestone, '', undefined, knowledge.knowledgeIdentity).identity;
}
