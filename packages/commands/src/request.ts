import type { Context } from 'cordis';
import { z } from 'zod';
import type { TaskObserver } from '../../workflow/src/index.js';
import { guideDraft, type GuideDraft } from '../../planner/src/guide-draft.js';
import { documentationSettings } from '../../architecture/src/documentation-settings.js';

const text = z
  .string()
  .refine((value) => Boolean(value.trim()), { message: 'Supply nonblank command input' });

export const workflowRequest = z.discriminatedUnion('command', [
  z
    .strictObject({
      command: z.literal('task_plan'),
      objective: text.optional(),
      mode: z.literal('recommend-objectives').optional(),
      focus: text.optional(),
      draft: guideDraft.optional(),
    })
    .refine(
      ({ objective, draft, mode, focus }) =>
        mode ? !objective && !draft : !focus && (!objective || !draft),
      'Submit a recommendation focus, objective, or exact guide edit',
    ),
  z.strictObject({ command: z.literal('task_run'), goal: text.optional() }),
  z
    .strictObject({
      command: z.literal('architecture_update'),
      feedback: text.optional(),
      documentation: documentationSettings.optional(),
    })
    .refine(
      ({ feedback, documentation }) => !(feedback && documentation),
      'Submit feedback or exact documentation settings',
    ),
  z.strictObject({ command: z.literal('refine'), rounds: z.string().regex(/^[0-9]*[1-9][0-9]*$/) }),
]);

export type WorkflowRequest = z.input<typeof workflowRequest>;
type PlanRequest = Extract<WorkflowRequest, { command: 'task_plan' }>;

/** Dispatch the same structured request for local CLI and trusted Host consumers. */
export async function dispatchWorkflow(
  commands: Context['commands'],
  directory: string,
  input: WorkflowRequest,
  observer: TaskObserver,
  signal: AbortSignal,
  retained?: { invocation: string; documentationDirectories?: string[] },
) {
  const selection = workflowRequest.parse(input);
  switch (selection.command) {
    case 'task_plan':
      return dispatchPlan(commands, directory, selection, observer, signal, retained);
    case 'task_run':
      return selection.goal === undefined
        ? commands.runRound(directory, observer, signal)
        : commands.runTask({ directory, goal: selection.goal }, observer, signal);
    case 'architecture_update':
      return commands.updateArchitecture(
        directory,
        selection.documentation ?? selection.feedback,
        observer,
        signal,
      );
    case 'refine':
      return commands.refine(directory, selection.rounds, observer, signal);
  }
}

function dispatchPlan(
  commands: Context['commands'],
  directory: string,
  request: PlanRequest,
  observer: TaskObserver,
  signal: AbortSignal,
  retained?: { invocation: string; documentationDirectories?: string[] },
) {
  if (request.draft)
    return dispatchGuideDraft(commands, directory, request.draft, observer, signal);
  if (!request.mode) return commands.planTask(directory, request.objective, observer, signal);
  return commands.runTask(
    {
      directory,
      goal: request.focus ?? 'Find objectives in project documentation',
      scope: ['plan:recommendation', retained?.invocation].filter(Boolean).join(':'),
      planning: 'recommendation',
      documentationDirectories: retained?.documentationDirectories,
    },
    observer,
    signal,
  );
}

async function dispatchGuideDraft(
  commands: Context['commands'],
  directory: string,
  draft: GuideDraft,
  observer: TaskObserver,
  signal: AbortSignal,
) {
  const bytes = new TextEncoder().encode(JSON.stringify(draft));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const identity = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const kind = draft.kind === 'objectives' ? 'objective' : 'goal';
  return commands.runTask(
    {
      directory,
      goal: `Edit ${kind} ${draft.id}`,
      scope: `plan:${kind}-edit:${identity}`,
      planning: 'objective',
      guideDraft: draft,
    },
    observer,
    signal,
  );
}
