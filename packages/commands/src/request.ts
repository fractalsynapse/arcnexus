import type { Context } from 'cordis';
import { z } from 'zod';
import type { TaskObserver } from '../../workflow/src/index.js';
import { goalDraft, type GoalDraft } from '../../planner/src/goal-draft.js';

const text = z
  .string()
  .refine((value) => Boolean(value.trim()), { message: 'Supply nonblank command input' });

export const workflowRequest = z.discriminatedUnion('command', [
  z
    .strictObject({
      command: z.literal('task_plan'),
      objective: text.optional(),
      draft: goalDraft.optional(),
    })
    .refine(
      ({ objective, draft }) => !objective || !draft,
      'Submit an objective or one exact goal edit',
    ),
  z.strictObject({ command: z.literal('task_run'), goal: text.optional() }),
  z.strictObject({ command: z.literal('architecture_update'), feedback: text.optional() }),
  z.strictObject({ command: z.literal('refine'), rounds: z.string().regex(/^[0-9]*[1-9][0-9]*$/) }),
]);

export type WorkflowRequest = z.input<typeof workflowRequest>;

/** Dispatch the same structured request for local CLI and trusted Host consumers. */
export async function dispatchWorkflow(
  commands: Context['commands'],
  directory: string,
  input: WorkflowRequest,
  observer: TaskObserver,
  signal: AbortSignal,
) {
  const selection = workflowRequest.parse(input);
  switch (selection.command) {
    case 'task_plan':
      if (selection.draft) {
        return dispatchGoalDraft(commands, directory, selection.draft, observer, signal);
      }
      return commands.planTask(directory, selection.objective, observer, signal);
    case 'task_run':
      return selection.goal === undefined
        ? commands.runRound(directory, observer, signal)
        : commands.runTask({ directory, goal: selection.goal }, observer, signal);
    case 'architecture_update':
      return commands.updateArchitecture(directory, selection.feedback, observer, signal);
    case 'refine':
      return commands.refine(directory, selection.rounds, observer, signal);
  }
}

async function dispatchGoalDraft(
  commands: Context['commands'],
  directory: string,
  draft: GoalDraft,
  observer: TaskObserver,
  signal: AbortSignal,
) {
  const bytes = new TextEncoder().encode(JSON.stringify(draft));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const identity = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return commands.runTask(
    {
      directory,
      goal: 'Edit goal ' + draft.id,
      scope: 'plan:goal-edit:' + identity,
      planning: 'objective',
      goalDraft: draft,
    },
    observer,
    signal,
  );
}
