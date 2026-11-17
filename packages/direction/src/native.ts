import type { Agent } from '../../agent/src/index.js';
import { hostTask, InvalidCodexResponse } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Feedback, Plan } from './index.js';
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
  plan?: Plan,
  feedback?: Feedback,
): Promise<unknown> {
  const task = hostTask(session);
  return task
    .activate(
      agent,
      task.capture.project.director,
      {
        assignment: { revision: revisionInstructions(feedback), ...shape, feedback },
        milestone: plan ?? 'Initial planning',
        acceptance: [],
        evidence: task.evidence.slice(),
      },
      signal,
    )
    .catch((error: unknown) => {
      if (error instanceof InvalidCodexResponse)
        throw new DirectorResponseError(error.message, { cause: error });
      throw error;
    });
}

/** Tell the Director which portions of the sequence the current feedback can change. */
function revisionInstructions(feedback?: Feedback): string {
  if (feedback?.kind === 'plan-repair')
    return `Correct the complete Director response using the exact diagnostic in feedback.diagnostic. The rejected reply is in the latest Director transcript in Evidence. Use feedback.original for the original request when present. ${revisionInstructions(feedback.original)}`;
  if (!feedback)
    return 'Plan the smallest sufficient changes for the goal. Keep the scope, owner and acceptance explicit.';
  const preserve = 'Preserve the exact Focus, completed milestones in order, and completed Steps.';
  if (feedback.kind === 'supplier') {
    return `${preserve} Put runnable work for feedback.owner before feedback.requester so that work can finish before the paused activity resumes. Move the existing supplier if feedback.milestone links one, or reuse it if complete. Give distinct correction work its own milestone, even when the requester and supplier have the same owner.`;
  }
  return `${preserve} For a rejection, append correction milestones with the original owner, criterion ID and description.`;
}
