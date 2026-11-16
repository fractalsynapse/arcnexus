import type { Agent } from '../../agent/src/index.js';
import type { Milestone, PlanActivity } from '../../direction/src/index.js';
import type { ActivityOutcome, TaskSession } from '../../workflow/src/index.js';
import { hostTask } from './index.js';
import type { CheckedEdit } from './edits.js';

type StewardResult =
  | { kind: 'completed'; edits: CheckedEdit[]; checks: { id: string; expected: 'pass' | 'fail' }[] }
  | Exclude<ActivityOutcome, { kind: 'completed' }>;

/** Run one Steward Agent activity and perform only the checked actions it requested. */
export async function steward(
  agent: Agent,
  session: TaskSession,
  milestone: Milestone,
  activity: Exclude<PlanActivity, 'release'>,
  signal: AbortSignal,
): Promise<ActivityOutcome> {
  const task = hostTask(session);
  await task.workspace(signal);
  const before = task.evidence.length;
  const result = (await task.activate(
    agent,
    { component: milestone.owner, activity },
    {
      assignment: responseShape(milestone.id),
      milestone: {
        id: milestone.id,
        step: milestone.steps.find((step) => step.activity === activity),
      },
      acceptance: milestone.criteria,
      evidence: task.evidence.slice(),
    },
    signal,
  )) as StewardResult;
  signal.throwIfAborted();
  validateStewardResult(result);
  if (result.kind !== 'completed') return { ...result, evidence: task.evidence.slice(before) };
  await perform(task, milestone.owner, activity, result, signal);
  return { kind: 'completed', evidence: task.evidence.slice(before) };
}

/** Refuse unexpected outcomes before acting on the steward response. */
function validateStewardResult(result: StewardResult) {
  if (!result || !['completed', 'supplier', 'question', 'blocked'].includes(result.kind))
    throw new Error('The steward returned an unsupported outcome');
}

/** Describe the bounded steward responses carried by the task prompt. */
function responseShape(milestone: string) {
  return {
    instructions:
      'Read the checkout and return one JSON object without code fences. The checkout is read-only. The host applies eligible edits and runs declared checks.',
    completed: {
      kind: 'completed',
      edits: [
        {
          path: 'owned path relative to the project',
          expected: 'sha256sum of current bytes or null for a new file',
          content: 'entire replacement text or null for deletion',
        },
      ],
      checks: [{ id: 'declared operation', expected: 'pass or fail for expected-red work' }],
    },
    supplier: {
      kind: 'supplier',
      milestone,
      owner: 'supplier component ID',
      reason: 'required contribution',
      evidence: [],
    },
    question: { kind: 'question', question: 'genuine human decision required', evidence: [] },
  };
}

/** Check all requested operation identities before executing any model-proposed action. */
async function perform(
  task: ReturnType<typeof hostTask>,
  owner: string,
  activity: string,
  result: Extract<StewardResult, { kind: 'completed' }>,
  signal: AbortSignal,
) {
  const component = task.capture.components[owner];
  const allowed = component?.activities[activity]?.operations ?? [];
  if (
    !Array.isArray(result.edits) ||
    !Array.isArray(result.checks) ||
    result.checks.some(
      ({ id, expected }) => !allowed.includes(id) || !['pass', 'fail'].includes(expected),
    )
  )
    throw new Error('The steward requested an unavailable edit or operation');
  if (result.edits.length) task.edits(owner, activity, result.edits);
  for (const { id, expected } of result.checks) {
    const check = await task.check(id, signal, owner);
    if (check.status === null || (check.status === 0) !== (expected === 'pass'))
      throw new Error(
        `Operation ${id} exited ${check.status}; expected ${expected}; evidence: ${check.log}`,
      );
  }
}
