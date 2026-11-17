import type { Agent } from '../../agent/src/index.js';
import { hostTask, InvalidCodexResponse } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Feedback, Plan, StandingGoalEvidence } from './index.js';
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
    'Include all five steps. Omit inapplicable for active steps. For an inactive step use an empty checklist and put its reason in inapplicable as a plain string.',
  delivery:
    'Put hosted CI, required PR review, and the observed staging merge in the Release checklist as future host observations. Reference engineering IDs there. Keep delivery observations and the independent verdict out of milestone criteria and steward work.',
  question: { kind: 'question', question: 'genuine human decision required', evidence: [] },
};

/** Ask the Director Agent to author the initial plan or the required correction. */
export function direct(
  agent: Agent,
  session: TaskSession,
  signal: AbortSignal,
  {
    plan,
    feedback,
    standing,
  }: { plan?: Plan; feedback?: Feedback; standing?: StandingGoalEvidence } = {},
): Promise<unknown> {
  const task = hostTask(session);
  return task
    .activate(
      agent,
      task.capture.project.director,
      {
        assignment: directorAssignment(feedback, standing),
        milestone: plan ?? (standing ? 'Standing goal assessment' : 'Initial planning'),
        acceptance: [],
        evidence: task.evidence.slice(),
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
function directorAssignment(feedback?: Feedback, standing?: StandingGoalEvidence) {
  const assignment = { revision: revisionInstructions(feedback), ...shape, feedback };
  if (!standing) return assignment;
  return {
    ...assignment,
    standingGoal: {
      ...standing,
      instructions:
        'Assess the full authored goal and its success measures on the captured staging revision. Read the retained check log and inspect the relevant implementation, tests, and recent changes. A passing suite is evidence. Look for uncovered requirements, incorrect tests, regressions introduced by other goals, and changes in the goal itself. If you find an actionable gap, return a bounded plan and name the observation that justifies it. When the measure passes and you find no concrete work, return satisfied with a concise rationale. The host attaches the measured owner check log. Ask a question when a genuine human decision is needed.',
    },
    satisfied: {
      kind: 'satisfied',
      summary: 'Why the requirements and measures warrant no work on this revision',
    },
  };
}

/** Tell the Director which portions of the sequence the current feedback can change. */
function revisionInstructions(feedback?: Feedback): string {
  if (feedback?.kind === 'plan-repair')
    return `Correct the complete Director response using the exact diagnostic in feedback.diagnostic. The rejected reply is in the latest Director transcript in Evidence. Use feedback.original for the original request when present. ${revisionInstructions(feedback.original)}`;
  if (!feedback)
    return 'Plan the smallest sufficient changes for the goal. Keep the scope, owner and acceptance explicit.';
  const preserve =
    'Preserve the exact Focus, completed milestones in order, and completed Steps. For a fresh correction, activate only activities with distinct work or evidence required by the finding. Mark the other Steps inapplicable with a reason.';
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
