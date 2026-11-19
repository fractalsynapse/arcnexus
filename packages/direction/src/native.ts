import type { Agent } from '../../agent/src/index.js';
import { hostTask, InvalidCodexResponse } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Feedback, StandingGoalEvidence } from './index.js';
import type { RevisionRequest } from './response.js';
import { DirectorResponseError } from './response.js';

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

/** Ask the Director Agent to author an initial plan or a bounded pending correction. */
export function direct(
  agent: Agent,
  session: TaskSession,
  signal: AbortSignal,
  {
    revision,
    feedback,
    standing,
  }: { revision?: RevisionRequest; feedback?: Feedback; standing?: StandingGoalEvidence } = {},
): Promise<unknown> {
  const task = hostTask(session);
  return task
    .activate(
      agent,
      task.capture.project.director,
      {
        assignment: directorAssignment(feedback, standing, revision),
        milestone: revision ?? (standing ? 'Standing goal assessment' : 'Initial planning'),
        acceptance: [],
        evidence: revision ? [] : task.evidence.slice(),
      },
      signal,
    )
    .catch(directorFailure);
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
  const revisionShape = request
    ? { ...shape, plan: { kind: 'plan', plan: { milestones: shape.plan.plan.milestones } } }
    : shape;
  const assignment = {
    revision: revisionInstructions(feedback, Boolean(request)),
    ...revisionShape,
    feedback,
    revisionContext: request && {
      acceptedPlan: request.acceptedPlan,
      retainedEvidence: request.retainedEvidence,
      position: request.position,
      finding: request.finding,
    },
  };
  if (!standing) return assignment;
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

/** Tell the Director which portions of the sequence the current feedback can change. */
function revisionInstructions(feedback?: Feedback): string {
  if (feedback?.kind === 'plan-repair')
    return `Correct only the pending Director response using the exact diagnostic in feedback.diagnostic. The rejected reply is in the latest Director transcript in Evidence. Use feedback.original for the original finding when present. ${revisionInstructions(feedback.original)}`;
  if (!feedback)
    return 'Plan the smallest sufficient changes for the goal. Keep the scope, owner and acceptance explicit.';
  const preserve =
    'Return only the necessary pending sequence. The host retains the accepted plan and completed outcomes; do not reproduce completed milestones or Steps. For a fresh correction, activate only activities with distinct work or evidence required by the finding. Mark the other Steps inapplicable with a reason.';
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
  const created = await provider.issue(task.goal, taskID, task.goalID);
  task.note({ issue: created });
  return created;
}
