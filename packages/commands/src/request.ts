import type { Context } from 'cordis';
import { z } from 'zod';
import type { TaskObserver } from '../../workflow/src/index.js';

const text = z
  .string()
  .refine((value) => Boolean(value.trim()), { message: 'Supply nonblank command input' });

export const workflowRequest = z.discriminatedUnion('command', [
  z.strictObject({ command: z.literal('task_plan'), objective: text.optional() }),
  z.strictObject({ command: z.literal('task_run'), goal: text.optional() }),
  z.strictObject({ command: z.literal('architecture_update'), feedback: text.optional() }),
  z.strictObject({ command: z.literal('refine'), rounds: z.string().regex(/^[0-9]*[1-9][0-9]*$/) }),
]);

export type WorkflowRequest = z.input<typeof workflowRequest>;

/** Dispatch the same structured request for local CLI and trusted Host consumers. */
export function dispatchWorkflow(
  commands: Context['commands'],
  directory: string,
  input: WorkflowRequest,
  observer: TaskObserver,
  signal: AbortSignal,
) {
  const selection = workflowRequest.parse(input);
  switch (selection.command) {
    case 'task_plan':
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
