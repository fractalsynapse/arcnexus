import { AgentActivityHold, InvalidAgentResponse } from '../../agent/src/index.js';
import type { Context } from 'cordis';
import { activities, type Plan, type Rejection } from '../../direction/src/index.js';
import {
  Clarifications,
  editFingerprint,
  hostTask,
  reconcileCheckpoint,
  saveCheckpoint,
  type CheckedEdit,
  verifiedGoalRun,
  type VerifiedGoalRun,
} from '../../execution/src/index.js';
import type { TaskInput, TaskObserver, TaskSession } from '../../workflow/src/index.js';
import { splitMarkdown } from '../../foundation/src/markdown-document.js';
import { readGoal } from './inventory.js';
import { guideDirectory, guideIndex, guideRecord, withGuideID } from './guide-index.js';
import type { GuideDraft } from './guide-draft.js';
import { plannerAssignment } from './assignment.js';
import { decodeProposal, type Proposal } from './proposal.js';
import {
  objectivePath,
  objectiveRecord,
  reportProposal,
  showPatch,
  textDigest,
  type GoalPatch,
  type HumanReply,
} from './records.js';

export { plannerDataPlugin, type ResolvePlanCapture } from './data.js';

declare module 'cordis' {
  interface Context {
    planner: Planner;
  }
}

const selection = { component: 'planner', activity: 'planning' };
type HostTask = ReturnType<typeof hostTask>;
type Mode = NonNullable<TaskInput['planning']>;
interface PendingProposal {
  proposal: Proposal;
  report: string;
  feedback?: string;
}
interface RetainedEdits {
  edits: CheckedEdit[];
  report: string;
}

/** Map captured goals and prepare exact records for reviewed delivery. */
export class Planner {
  /** Use the application's Agent service for every Planner proposal and refinement. */
  constructor(private readonly agent: Context['agent']) {}

  /** Retain the exact operator draft and bind the checked edit to its captured revision. */
  async proposeDraft(
    session: TaskSession,
    draft: GuideDraft,
    progress: TaskObserver['progress'],
    signal: AbortSignal,
  ) {
    const task = hostTask(session);
    const { source } = task.capture;
    if (source.revision !== draft.revision) throw new Error('The selected guide revision is stale');
    const kind = draft.kind ?? 'goals';
    const existing = guideIndex(task.capture, kind).get(draft.id);
    if (!existing) throw new Error('The selected guide is unavailable');
    const { path, content: before } = existing;
    validateDraft(task, path, draft);
    if (before === draft.content) return planned(task, 'The guide is unchanged.', []);
    signal.throwIfAborted();
    const edits = [{ path, before, content: draft.content }];
    const report = task.store('guide-draft.diff', showPatch(edits));
    if (kind === 'objectives') {
      const authorization = {
        id: draft.id,
        revision: draft.revision,
        ...toCheckedEdit(edits[0]!),
        report,
      };
      task.note({ objectiveDraftAuthorization: authorization });
    }
    progress({ phase: 'planning', message: 'Guide draft prepared for review', evidence: [report] });
    return retainEdits(task, edits, report);
  }

  /** Report a mapping, or use the shared task lane to deliver its approved records. */
  async propose(
    session: TaskSession,
    mode: Mode,
    progress: TaskObserver['progress'],
    signal: AbortSignal,
    findings?: readonly Rejection[],
  ) {
    const task = hostTask(session);
    const objective = mode === 'objective';
    if (objective && session.capture.source.paths.includes(objectivePath(session)))
      return planned(task, 'The exact objective is already recorded.', [objectivePath(session)]);
    if (!task.branch) task.planningWorkspace(signal);
    const run = verifiedGoalRun(task);
    const data = assignment(task, objective, run, findings);
    const previous = findings ? appliedEdits(task) : undefined;
    const { proposal, report } = await this.proposal(task, data, signal, previous);
    progress({
      phase: 'planning',
      message: 'Planner mapped the captured project',
      evidence: [report],
    });
    const edits = goalPatches(task, proposal, previous);
    if (
      objective &&
      !(await includeObjective(task, { proposal, edits, previous, data, signal, progress }))
    )
      return planned(task, 'The objective change was declined.', [report]);
    return retainEdits(task, edits, report);
  }

  /** Apply exactly the journaled edits, skipping files already recovered from checkpoints. */
  async apply(session: TaskSession, signal: AbortSignal) {
    const task = hostTask(session);
    const result = task
      .observations<{ plannerEdits?: RetainedEdits }>()
      .findLast(({ plannerEdits }) => plannerEdits)?.plannerEdits;
    if (!task.worktree || !task.branch || !result)
      throw new Error('Planner requires journaled edits and a prepared issue branch');
    for (const edit of result.edits) {
      signal.throwIfAborted();
      const target = edit.content === null ? null : textDigest(edit.content);
      if (editFingerprint(task.worktree, task.capture, selection.component, edit.path) === target)
        continue;
      task.edits(selection.component, 'documentation', [edit]);
      saveCheckpoint(task);
      await reconcileCheckpoint(task, signal);
    }
    return { kind: 'completed' as const, evidence: [result.report] };
  }

  /** Keep the same proposal and exact bytes on a restart at the approval gate. */
  private async proposal(
    task: HostTask,
    data: ReturnType<typeof assignment>,
    signal: AbortSignal,
    previous?: Map<string, string | null>,
  ) {
    const revision = task.capture.source.revision;
    const feedback = data.assignment.review && textDigest(JSON.stringify(data.assignment.review));
    const events = task.observations<{
      plannerProposal?: PendingProposal;
      revision?: string;
      assessment?: unknown;
    }>();
    const afterAssessment = events.slice(events.findLastIndex((event) => event.assessment) + 1);
    const prior = afterAssessment.findLast(
      (event) => event.revision === revision && event.plannerProposal?.feedback === feedback,
    )?.plannerProposal;
    if (prior) return prior;
    const proposal = await this.generate(task, data, signal, previous);
    const report = task.store(
      'goal-mapping.md',
      reportProposal(proposal, task.capture.source, goalPatches(task, proposal, previous)),
    );
    const plannerProposal = { proposal, report, feedback };
    task.note({ plannerProposal, revision });
    return plannerProposal;
  }

  /** Repair distinct response findings in the original mapping and hold unchanged repetition. */
  private async generate(
    task: HostTask,
    data: ReturnType<typeof assignment>,
    signal: AbortSignal,
    previous?: Map<string, string | null>,
  ) {
    const ids = [...guideIndex(task.capture, 'goals', previous).keys()];
    const seen = new Set<string>();
    let diagnostic: string | undefined;
    while (true) {
      signal.throwIfAborted();
      try {
        const input = { ...data, assignment: { ...data.assignment, diagnostic } };
        const reply = await task.activate(this.agent, selection, input, signal);
        return validateReply(task, data, ids, reply);
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof InvalidAgentResponse)) throw error;
        if (seen.has(error.identity))
          throw new AgentActivityHold(
            `Planner repeated an unchanged finding: ${error.message}`,
            task.evidence.slice(),
          );
        seen.add(error.identity);
        diagnostic = error.message;
        task.note({ plannerResponseRepair: diagnostic });
      }
    }
  }
}

/** Keep identity stable across an edit and enforce the selected collection's document rules. */
function validateDraft(task: HostTask, path: string, { kind = 'goals', id, content }: GuideDraft) {
  if (guideRecord(task.capture, kind, path, content).id !== id)
    throw new Error('A guide edit must preserve its record ID');
  if (kind === 'goals') readGoal(id, content);
  else if (!splitMarkdown(content).body.trim()) throw new Error('An objective needs text');
}

/** Keep model-authored objective bytes out of the checked batch until authorized. */
async function includeObjective(
  task: HostTask,
  input: {
    proposal: Proposal;
    edits: GoalPatch[];
    previous?: Map<string, string | null>;
    data: ReturnType<typeof assignment>;
    signal: AbortSignal;
    progress: TaskObserver['progress'];
  },
) {
  const { proposal, edits, previous, data, signal, progress } = input;
  const dialogue = new Clarifications(task, selection, signal);
  const record = objectiveEdit(task, proposal, dialogue.answers(data), edits, previous);
  record.before = previous?.get(record.path) ?? null;
  if (record.before === record.content) return true;
  if (!(await reviewObjective(task, dialogue, record, progress))) return false;
  edits.push(record);
  return true;
}

/** Retain a human decision against the exact objective patch and captured baseline. */
async function reviewObjective(
  task: HostTask,
  dialogue: Clarifications,
  edit: GoalPatch,
  progress: TaskObserver['progress'],
) {
  const patch = showPatch([edit]);
  const key = textDigest(JSON.stringify([task.capture.source.revision, edit]));
  const answer = await dialogue.decide(
    { milestone: `Objective review ${key}`, assignment: '', acceptance: [], evidence: [] },
    `Review this exact objective change. Reply approve to authorize it, or skip to decline.\n\n${patch}`,
    (reply) => /^(approve|skip)$/i.test(reply.trim()),
  );
  const approved = answer.trim().toLowerCase() === 'approve';
  const evidence = task.store('objective-decision.md', `Decision: ${answer}\n\n${patch}\n`);
  progress({
    phase: 'planning',
    message: approved ? 'Objective change approved' : 'Objective change declined',
    evidence: [evidence],
  });
  return approved;
}

/** Keep one exact edit receipt for review, checkpointing and delivery. */
function retainEdits(task: HostTask, edits: GoalPatch[], report: string) {
  if (!edits.length)
    return planned(task, 'Goal mapping completed with no inventory changes.', [report]);
  task.note({ plannerEdits: { edits: edits.map(toCheckedEdit), report } satisfies RetainedEdits });
  return deliveryPlan(task, edits, report);
}

/** Distinguish a repairable proposal from an execution or human gate failure. */
class ProposalError extends InvalidAgentResponse {}

/** Keep model validation failures eligible for the ordinary Planner repair. */
function validateReply(
  task: TaskSession,
  data: ReturnType<typeof assignment>,
  ids: string[],
  reply: unknown,
) {
  try {
    return decodeProposal(
      reply,
      task.capture,
      ids,
      data.assignment.mode === 'human objective',
      data.assignment.verifiedRun,
    );
  } catch (error) {
    throw new ProposalError((error as Error).message, { cause: error });
  }
}

/** Derive complete Planner activity input once so dialogue resumes at the same position. */
function assignment(
  task: TaskSession,
  objective: boolean,
  run?: VerifiedGoalRun,
  findings?: readonly Rejection[],
) {
  return {
    assignment: { ...plannerAssignment(task, objective, run), review: findings },
    milestone: 'Assess the standing goal inventory',
    acceptance: [],
    evidence: findings?.flatMap(({ evidence }) => evidence) ?? [],
  };
}

/** Resolve the current path for each stable goal ID before binding checked preimages. */
function goalPatches(task: TaskSession, proposal: Proposal, previous?: Map<string, string | null>) {
  const current = guideIndex(task.capture, 'goals', previous);
  const captured = previous && guideIndex(task.capture, 'goals');
  const root = guideDirectory(task.capture, 'goals');
  return proposal.changes.flatMap(({ id, content, category = 'general' }) => {
    const existing = current.get(id);
    const path = existing?.path ?? captured?.get(id)?.path ?? `${root}/${category}/${id}.md`;
    const before = existing?.content ?? null;
    const after =
      content === null || (existing && !existing.category) ? content : withGuideID(content, id);
    return before === after ? [] : [{ path, before, content: after }];
  });
}

/** Derive the current candidate bytes from successful earlier Planner writes. */
function appliedEdits(task: HostTask) {
  const edits = task
    .observations<{ plannerEdits?: RetainedEdits }>()
    .flatMap((event) => event.plannerEdits?.edits ?? []);
  const observed = new Map<string, string | null>();
  for (const { path, content } of edits.reverse()) {
    if (observed.has(path)) continue;
    const target = content === null ? null : textDigest(content);
    if (editFingerprint(task.worktree!, task.capture, selection.component, path) === target)
      observed.set(path, content);
  }
  return observed;
}

/** Record the submission with the expected disposition of each linked stable goal. */
function objectiveEdit(
  task: TaskSession,
  proposal: Proposal,
  replies: readonly HumanReply[],
  edits: readonly GoalPatch[],
  previous?: Map<string, string | null>,
): GoalPatch {
  const candidate = new Map(previous);
  for (const { path, content } of edits) candidate.set(path, content);
  const goals = new Set(guideIndex(task.capture, 'goals', candidate).keys());
  return {
    path: objectivePath(task, proposal.objectiveFile, previous),
    before: null,
    content: objectiveRecord(task, proposal, replies, goals),
  };
}

/** Bind each edit to its captured starting bytes. */
function toCheckedEdit({ path, before, content }: GoalPatch): CheckedEdit {
  return { path, expected: before === null ? null : textDigest(before), content };
}

/** Record a completed planning result at the revision it evaluated. */
function planned(task: TaskSession, summary: string, evidence: readonly string[]) {
  return { kind: 'planned' as const, commit: task.capture.source.revision, summary, evidence };
}

/** Route the exact Planner bytes through the ordinary documented milestone and independent review. */
function deliveryPlan(task: TaskSession, edits: readonly GoalPatch[], report: string): Plan {
  const id = 'exact-planner-records';
  const paths = edits.map((edit) => edit.path).join(', ');
  const focus = {
    purpose: 'Preserve scoped Planner records from the captured project',
    objectives: [task.goal],
    constraints: [
      'Review exact journaled guide bytes and retain human authorization for objectives',
    ],
  };
  const criteria = [
    {
      id,
      description: `The exact guide changes are reflected in ${paths}; compare with ${report} and any retained objective decision.`,
    },
  ];
  const steps = guideDeliverySteps(id);
  return { focus, milestones: [{ id, owner: selection.component, criteria, steps }] };
}

/** Use the ordinary checked-edit and release activities for Markdown-only delivery. */
function guideDeliverySteps(id: string) {
  return activities.map((activity) => {
    if (activity !== 'documentation' && activity !== 'release')
      return {
        activity,
        inapplicable: 'The change is confined to reviewed Markdown records',
        checklist: [],
      };
    const expected =
      activity === 'documentation'
        ? 'Exact checked Markdown file contents'
        : 'Verified staging integration';
    return { activity, checklist: [{ id: activity, criteria: [id], expected }] };
  });
}

export const plannerPlugin = {
  inject: ['agent'],
  /** Mount the Planner that supplies the task workflow's planning mode. */
  apply(context: Context) {
    context.provide('planner', new Planner(context.agent));
  },
};
