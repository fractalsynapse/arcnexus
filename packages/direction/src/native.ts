import type { Agent } from '../../agent/src/index.js';
import { hostTask } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { DirectionResult, Feedback, Plan } from './index.js';

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
          criteria: [{ id: 'stable id', description: 'observable acceptance' }],
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
    'Include all five steps. Omit inapplicable entirely for active steps. For an inactive step use an empty checklist and inapplicable with its reason. Release is performed by the host.',
  question: { kind: 'question', question: 'genuine human decision required', evidence: [] },
};

/** Ask the Director Agent to author the initial plan or the required correction. */
export async function direct(
  agent: Agent,
  session: TaskSession,
  signal: AbortSignal,
  plan?: Plan,
  feedback?: Feedback,
): Promise<DirectionResult> {
  const task = hostTask(session);
  const revision = feedback
    ? 'Preserve the exact Focus and completed milestones in their given order. For a rejection, append correction milestones with the original owner, criterion ID and description.'
    : 'Plan the smallest sufficient changes for the goal. Keep the scope, owner and acceptance explicit.';
  const result = (await task.activate(
    agent,
    task.capture.project.director,
    {
      assignment: { revision, ...shape, feedback },
      milestone: plan ?? 'Initial planning',
      acceptance: [],
      evidence: task.evidence.slice(),
    },
    signal,
  )) as DirectionResult;
  if (!result || (result.kind !== 'plan' && result.kind !== 'question'))
    throw new Error('The Director returned an unsupported outcome');
  if (result.kind === 'question' && (!result.question?.trim() || !Array.isArray(result.evidence)))
    throw new Error('The Director returned an invalid human question');
  return result;
}
