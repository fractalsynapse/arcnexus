import type { Context } from 'cordis';
import { activities, type Plan } from '../../direction/src/index.js';
import {
  Clarifications,
  editFingerprint,
  hostTask,
  InvalidCodexResponse,
  reconcileCheckpoint,
  saveCheckpoint,
  type CheckedEdit,
} from '../../execution/src/index.js';
import type { TaskInput, TaskObserver, TaskSession } from '../../workflow/src/index.js';
import { goalInventory } from './inventory.js';
import { plannerAssignment, pathForGoal } from './assignment.js';
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
}
interface ApprovedEdits {
  edits: CheckedEdit[];
  report: string;
}

/** Map captured goals, preserve the objective dialogue and prepare an exact approved edit set. */
export class Planner {
  /** Use the application's Agent service for every Planner proposal and refinement. */
  constructor(private readonly agent: Context['agent']) {}

  /** Report a mapping, or use the shared task lane to deliver its approved records. */
  async propose(
    session: TaskSession,
    mode: Mode,
    progress: TaskObserver['progress'],
    signal: AbortSignal,
  ) {
    const task = hostTask(session);
    const objective = mode === 'objective';
    const path = objectivePath(session);
    if (objective && session.capture.source.paths.includes(path))
      return planned(task, 'The exact objective is already recorded.', [path]);
    task.planningWorkspace(signal);
    const data = assignment(task, objective);
    const clarifications = new Clarifications(task, selection, signal);
    const { proposal, report } = await this.proposal(task, objective, data, signal);
    const proposed = goalPatches(task, proposal);
    progress({
      phase: 'planning',
      message: 'Planner mapped the captured project',
      evidence: [report],
    });
    const edits = await this.approve(task, clarifications, proposed, progress);
    if (objective) edits.push(objectiveEdit(task, proposal, clarifications.answers(data), edits));
    if (!edits.length)
      return planned(task, 'Goal mapping completed with no approved inventory changes.', [report]);
    task.note({
      plannerEdits: { edits: edits.map(toCheckedEdit), report } satisfies ApprovedEdits,
    });
    return deliveryPlan(task, edits, report);
  }

  /** Apply exactly the journaled edits, skipping files already recovered from checkpoints. */
  async apply(session: TaskSession, signal: AbortSignal) {
    const task = hostTask(session);
    const approval = task
      .observations<{ plannerEdits?: ApprovedEdits }>()
      .findLast(({ plannerEdits }) => plannerEdits)?.plannerEdits;
    if (!task.worktree || !task.branch || !approval)
      throw new Error('Planner requires journaled edits and a prepared issue branch');
    for (const edit of approval.edits) {
      signal.throwIfAborted();
      const target = edit.content === null ? null : textDigest(edit.content);
      if (editFingerprint(task.worktree, task.capture, selection.component, edit.path) === target)
        continue;
      task.edits(selection.component, 'documentation', [edit]);
      saveCheckpoint(task);
      await reconcileCheckpoint(task, signal);
    }
    return { kind: 'completed' as const, evidence: [approval.report] };
  }

  /** Keep the same proposal and exact bytes on a restart at the approval gate. */
  private async proposal(
    task: HostTask,
    objective: boolean,
    data: ReturnType<typeof assignment>,
    signal: AbortSignal,
  ) {
    const revision = task.capture.source.revision;
    const prior = task
      .observations<{ plannerProposal?: PendingProposal; revision?: string }>()
      .findLast((event) => event.revision === revision && event.plannerProposal)?.plannerProposal;
    if (prior) return prior;
    const proposal = await this.generate(task, objective, data, signal);
    const report = task.store(
      'goal-mapping.md',
      reportProposal(proposal, task.capture.source, goalPatches(task, proposal)),
    );
    const plannerProposal = { proposal, report };
    task.note({ plannerProposal, revision });
    return plannerProposal;
  }

  /** Repair one invalid model response in its original clarification scope. */
  private async generate(
    task: HostTask,
    objective: boolean,
    data: ReturnType<typeof assignment>,
    signal: AbortSignal,
  ) {
    const ids = goalInventory(task.capture).map(({ id }) => id);
    const ask = async (input: typeof data) => {
      const reply = await task.activate(this.agent, selection, input, signal);
      try {
        return decodeProposal(reply, task.capture, ids, objective);
      } catch (error) {
        throw new ProposalError((error as Error).message, { cause: error });
      }
    };
    try {
      return await ask(data);
    } catch (error) {
      if (signal.aborted) throw error;
      if (!(error instanceof InvalidCodexResponse) && !(error instanceof ProposalError))
        throw error;
      return await ask({
        ...data,
        assignment: { ...data.assignment, diagnostic: error.message },
      });
    }
  }

  /** Limit the human gate to changes to active goals, leaving submitted records durable. */
  private async approve(
    task: HostTask,
    clarifications: Clarifications,
    edits: GoalPatch[],
    progress: TaskObserver['progress'],
  ) {
    if (!edits.length) return edits.slice();
    const patch = showPatch(edits);
    const answer = await clarifications.decide(
      {
        milestone: `Goal approval ${textDigest(patch)}`,
        assignment: '',
        acceptance: [],
        evidence: [],
      },
      `Review these exact goal changes. Reply approve to apply them, or skip to leave the inventory as it is.\n\n${patch}`,
    );
    const approved = answer.trim().toLowerCase() === 'approve';
    const evidence = task.store(
      'inventory-decision.md',
      `Decision: ${approved ? 'approved' : 'declined'}\n\n${patch}\n`,
    );
    progress({
      phase: 'planning',
      message: approved ? 'Goal changes approved' : 'Goal inventory unchanged',
      evidence: [evidence],
    });
    return approved ? edits.slice() : [];
  }
}

/** Distinguish a repairable proposal from an execution or human gate failure. */
class ProposalError extends Error {}

/** Derive complete Planner activity input once so dialogue resumes at the same position. */
function assignment(task: TaskSession, objective: boolean) {
  return {
    assignment: plannerAssignment(task, objective),
    milestone: 'Assess the standing goal inventory',
    acceptance: [],
    evidence: [],
  };
}

/** Translate approved inventory IDs into exact captured file changes. */
function goalPatches(task: TaskSession, proposal: Proposal) {
  const { source } = task.capture;
  return proposal.changes.flatMap(({ id, content }) => {
    const path = pathForGoal(task, id);
    const before = source.paths.includes(path) ? source.read(path) : null;
    return before === content ? [] : [{ path, before, content }];
  });
}

/** Record the exact submission with each linked goal's disposition after approved edits. */
function objectiveEdit(
  task: TaskSession,
  proposal: Proposal,
  replies: readonly HumanReply[],
  edits: readonly GoalPatch[],
): GoalPatch {
  const goals = new Set(goalInventory(task.capture).map(({ id }) => id));
  for (const { path, content } of edits) {
    const id = path.split('/').at(-1)!.slice(0, -3);
    if (content === null) goals.delete(id);
    else goals.add(id);
  }
  return {
    path: objectivePath(task),
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
    constraints: ['Publish only journaled objective records and exactly approved goal bytes'],
  };
  const criteria = [
    {
      id,
      description: `The captured objective or approved inventory disposition is reflected in ${paths}; compare with ${report} and the retained human evidence.`,
    },
  ];
  const steps = activities.map((activity) => {
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
  return { focus, milestones: [{ id, owner: selection.component, criteria, steps }] };
}

export const plannerPlugin = {
  inject: ['agent'],
  /** Mount the Planner that supplies the task workflow's planning mode. */
  apply(context: Context) {
    context.provide('planner', new Planner(context.agent));
  },
};
