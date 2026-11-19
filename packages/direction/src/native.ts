import type { Agent } from '../../agent/src/index.js';
import { hostTask, InvalidCodexResponse, type HostTask } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Feedback, Plan, StandingGoalEvidence } from './index.js';
import type { RevisionRequest } from './response.js';
import { decodeRevisionResponse, DirectorResponseError } from './response.js';

const shape = {
  response: 'Return one JSON object only. No code fences.',
  plan: {
    kind: 'plan',
    plan: {
      focus: { purpose: 'string', objectives: ['string'], constraints: ['string'] },
      milestones: [
        {
          id: 'stable id',
          owner: 'component id',
          criteria: [
            {
              id: 'stable id',
              description: 'engineering evidence available before independent review and delivery',
            },
          ],
          steps: [
            {
              activity: 'documentation, testing, implementation, review, release (in order)',
              checklist: [
                { id: 'stable id', criteria: ['criterion id'], expected: 'observable result' },
              ],
            },
          ],
        },
      ],
    },
  },
  inapplicable:
    'For each required Step, use an empty checklist and put its reason in inapplicable as a plain string only when inactive.',
  delivery:
    'Put hosted CI, required PR review, and the observed staging merge in the Release checklist as future host observations. Reference engineering IDs there. Keep delivery observations and the independent verdict out of milestone criteria and steward work.',
  question:
    'When a genuine decision needs human authority, use the mapped ask-question tool and end this activation.',
};

interface DirectorOptions {
  plan?: Plan;
  feedback?: Feedback;
  standing?: StandingGoalEvidence;
}

/** Ask the Director Agent to author an initial plan or a bounded pending correction. */
export function direct(
  agent: Agent,
  session: TaskSession,
  signal: AbortSignal,
  { plan, feedback, standing }: DirectorOptions = {},
): Promise<unknown> {
  const task = hostTask(session);
  const revision = plan && feedback ? revisionRequest(task, plan, feedback) : undefined;
  return task
    .activate(
      agent,
      task.capture.project.director,
      {
        assignment: actorAssignment(task, feedback, standing, revision),
        milestone: revision
          ? 'Pending plan revision'
          : standing
            ? 'Standing goal assessment'
            : 'Initial planning',
        acceptance: [],
        evidence: revision ? revisionEvidence(revision) : task.evidence.slice(),
      },
      signal,
    )
    .then((reply) =>
      revision ? decodeRevisionResponse(reply, task.capture, plan!, revision) : reply,
    )
    .catch(directorFailure);
}

/** Retain complete history by reference and inline only the current finding's evidence links. */
function revisionEvidence(request: RevisionRequest) {
  const finding = request.finding;
  const evidence =
    finding.kind === 'rejection'
      ? finding.findings.flatMap(({ evidence }) => evidence)
      : finding.evidence;
  return [...new Set([request.acceptedPlan, request.retainedEvidence, ...evidence])];
}

/** Store the canonical host plan and observations without copying them into the model request. */
function revisionRequest(task: HostTask, plan: Plan, feedback: Feedback): RevisionRequest {
  const position = task.history().findLast((event) => 'position' in event);
  const finding = feedback.kind === 'plan-repair' ? feedback.original : feedback;
  if (!finding)
    throw new DirectorResponseError('Accepted-plan repair requires its original finding');
  return {
    acceptedPlan: task.store('accepted-plan.json', JSON.stringify(plan)),
    retainedEvidence: task.store('retained-evidence.json', JSON.stringify(task.observations())),
    position: pendingPosition(
      plan,
      position && 'position' in position ? position.position : undefined,
    ),
    finding,
  };
}

/** Send only pending activity cursors while retaining the complete position in host history. */
function pendingPosition(plan: Plan, position?: RevisionRequest['position']) {
  const completed = position?.completed ?? 0;
  const pending = new Set(plan.milestones.slice(completed).map(({ id }) => id));
  return {
    completed,
    activities: Object.fromEntries(
      Object.entries(position?.activities ?? {}).filter(([id]) => pending.has(id)),
    ),
  };
}

/** Preserve harness failures and give unreadable responses the normal Director repair path. */
function directorFailure(error: unknown): never {
  if (error instanceof InvalidCodexResponse)
    throw new DirectorResponseError(error.message, { cause: error });
  throw error;
}

/** Give the Director the current observation and a decision that can open engineering work. */
function directorAssignment(
  feedback?: Feedback,
  standing?: StandingGoalEvidence,
  request?: RevisionRequest,
) {
  const assignment = directorAssignmentBase(feedback, request);
  return standing ? standingAssignment(assignment, standing) : assignment;
}

/** Add standing-goal assessment evidence and its required response shape. */
function standingAssignment(
  assignment: ReturnType<typeof directorAssignmentBase>,
  standing: StandingGoalEvidence,
) {
  return {
    ...assignment,
    standingGoal: {
      revision: standing.revision,
      recentChanges: standing.recentChanges,
      verifiedRun: standing.run,
      requiresRun: standing.requiresRun,
      instructions:
        'Assess all measures on this staging revision using local MCP. Look for uncovered requirements, stale tests, and regressions from other goals. Distinguish test source from a verified execution result. If current evidence cannot establish a measure, plan the applicable checks through existing steward activities. Return satisfied only with a rationale and evidence for each measure. Quote exact excerpts from tracked files that actually establish the outcome. For observed runs, cite the matching verified run by id and explain which check or independently reviewed criterion supports a specific measure. If requiresRun is true, a valid verified run citation is required. A passing repository suite does not prove an unexercised live behavior. Ask a human question when a genuine decision is needed.',
    },
    satisfied: {
      kind: 'satisfied',
      summary: 'Why each requirement and measure warrants no work on this revision',
      evidence: [
        { path: 'tracked file path', quote: 'exact meaningful excerpt from the file' },
        {
          run: 'verified run id',
          operation: 'observed operation id, or use criterion or delivery: true',
        },
      ],
    },
  };
}

/** Builds shared Director fields without adding standing-goal context. */
function directorAssignmentBase(feedback?: Feedback, request?: RevisionRequest) {
  const revisionShape = request
    ? {
        ...shape,
        plan: {
          kind: 'plan',
          plan: {
            milestones: [
              { id: 'existing accepted milestone id', steps: shape.plan.plan.milestones[0]!.steps },
              { ...shape.plan.plan.milestones[0], id: 'new distinct milestone id' },
            ],
          },
        },
      }
    : shape;
  return {
    revision: revisionInstructions(feedback, Boolean(request)),
    ...revisionShape,
    inapplicable: request ? shape.inapplicable : `Include all five Steps. ${shape.inapplicable}`,
    feedback,
    revisionContext: request && {
      acceptedPlan: request.acceptedPlan,
      retainedEvidence: request.retainedEvidence,
      position: request.position,
      finding: request.finding,
    },
  };
}

/** Tell the Director which portions of the sequence the current feedback can change. */
function revisionInstructions(feedback?: Feedback, bounded = false): string {
  if (feedback?.kind === 'plan-repair') {
    const boundary = bounded
      ? 'Correct only the pending Director response.'
      : 'Correct the complete initial plan response.';
    const evidence = bounded ? 'the immutable retained-evidence index' : 'Evidence';
    return `${boundary} Use the exact diagnostic in feedback.diagnostic. Find the rejected reply in ${evidence}. Use feedback.original for the original finding when present. ${revisionInstructions(feedback.original, bounded)}`;
  }
  if (!feedback)
    return 'Plan the smallest sufficient changes for the goal. Keep the scope, owner and acceptance explicit.';
  const preserve = bounded
    ? 'Return the complete pending milestone sequence, omitting completed milestones and Steps. The host retains the accepted plan and completed outcomes. For each existing milestone, return only id and Steps after its committed position; omit owner and criteria because the host restores their immutable accepted values. For each new milestone, include owner, criteria and all five Steps. Activate only activities with distinct work or evidence required by the finding; mark other Steps inapplicable with a reason.'
    : 'Return a complete plan. For each milestone, include all five Steps and mark inactive Steps inapplicable with a reason.';
  if (feedback.kind === 'supplier') {
    if (feedback.failedCheck)
      return `${preserve} Add a fresh correction milestone owned by feedback.owner before feedback.requester. Activate feedback.failedCheck.activity so the steward can diagnose the retained exit and log and correct the work. Reference the original engineering criteria. The host reruns the original check before the paused activity resumes.`;
    return `${preserve} Put runnable work for feedback.owner before feedback.requester so that work can finish before the paused activity resumes. Move the existing supplier if feedback.milestone links one, or reuse it if complete. Give distinct correction work its own milestone, even when the requester and supplier have the same owner.`;
  }
  return `${preserve} For a rejection, append correction milestones with the original owner, criterion ID and description.`;
}

/** Observe the task's hosted issue before creating or reusing its tracking identity. */
export async function track(session: TaskSession, signal: AbortSignal): Promise<string> {
  const task = hostTask(session);
  const recorded = task.observations<{ issue?: string; issueIntent?: string }>();
  const provider = task.provider(signal);
  const prior = recorded.findLast(({ issue }) => issue)?.issue;
  if (prior) {
    await provider.verifyIssue(prior);
    return prior;
  }
  const taskID = task.taskID;
  const issue = await provider.findIssue(taskID, task.goalID);
  if (issue) {
    task.note({ issue });
    return issue;
  }
  if (recorded.some(({ issueIntent }) => issueIntent === taskID))
    throw new Error(`Cannot yet confirm the GitHub issue for task ${taskID}`);
  task.note({ issueIntent: taskID });
  const created = await provider.issue(task.goal, taskID, task.goalID, task.trackingTitle);
  task.note({ issue: created });
  return created;
}

/** Give Direction approved prerequisite outcomes while keeping the exact protected writes host-owned. */
function architectureDirective(task: HostTask) {
  const approved = task.guide;
  if (!approved) return;
  const { proposal } = approved;
  const prior = task
    .observations<{ architectureAuthority?: { id: string; report: string } }>()
    .findLast(
      ({ architectureAuthority }) => architectureAuthority?.id === proposal.id,
    )?.architectureAuthority;
  const report =
    prior?.report ?? task.store('approved-architecture.json', JSON.stringify(approved));
  if (!prior) task.note({ architectureAuthority: { id: proposal.id, report } });
  return {
    purpose: proposal.purpose,
    consequences: proposal.consequences,
    implementation: proposal.implementation,
    exactProposal: report,
    hostApplication:
      'Plan implementation and verification of the approved outcomes. Do not ask stewards to edit protected guide files. The host applies the exact approved batch after milestones and before assembled independent verification. If no prerequisite code is needed, schedule the smallest read-only architecture review of the proposal and its applicability.',
  };
}

/** Combine normal planning with verified prerequisite outcomes and any read-only question. */
function actorAssignment(
  task: HostTask,
  feedback?: Feedback,
  standing?: StandingGoalEvidence,
  revision?: RevisionRequest,
) {
  return {
    ...directorAssignment(feedback, standing, revision),
    architecture: architectureDirective(task),
    inbox: task.inbox && {
      ...task.inbox,
      instructions:
        'Answer this question completely through read-only steward review. Include the requested owner and require a complete answer. No source changes are authorized for an inbox contribution.',
    },
  };
}
