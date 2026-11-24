import type { Context } from 'cordis';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../data/src/index.js';
import type { WorkflowRequests } from '../../coordination/src/index.js';
import { workflowRequest } from './request.js';

export const workflowSelection = z.strictObject({ id: z.uuid() });
export const workflowReceipt = z.strictObject({
  id: z.uuid(),
  request: workflowRequest,
  revision: z.string(),
  state: z.enum(['queued', 'running', 'waiting', 'finished']),
  execution: z.string().nullable(),
  gate: z.strictObject({ id: z.string(), question: z.string() }).nullable(),
  outcome: z.unknown(),
});

export const workflowSubmission = workflowSelection.extend({ request: workflowRequest });
export const workflowAnswer = workflowSelection.extend({
  gate: z.string(),
  answer: z.string().refine((answer) => Boolean(answer.trim())),
});

type Resolve = (scope: DataScope) => Promise<{ remote: string; revision: string } | undefined>;

async function caller(scope: DataScope, resolve: Resolve) {
  const project = await resolve(scope);
  if (!project) throw new Error('This project has no verified hosted assignment');
  return { ...project, principal: scope.principal };
}

function operations(requests: WorkflowRequests, resolve: Resolve) {
  return {
    create: dataOperation(workflowSubmission, workflowReceipt, async (scope, input) => {
      const binding = await caller(scope, resolve);
      return workflowReceipt.parse(
        await requests.submit(binding, input.id, input.request, binding.revision),
      );
    }),
    read: dataOperation(workflowSelection, workflowReceipt, async (scope, { id }) =>
      workflowReceipt.parse(await requests.read(await caller(scope, resolve), id)),
    ),
    cancel: dataOperation(workflowSelection, workflowReceipt, async (scope, { id }) =>
      workflowReceipt.parse(await requests.cancel(await caller(scope, resolve), id)),
    ),
    answer: dataOperation(workflowAnswer, workflowReceipt, async (scope, input) =>
      workflowReceipt.parse(
        await requests.answer(await caller(scope, resolve), input.id, input.gate, input.answer),
      ),
    ),
  };
}

/** Publish the lifecycle shared by the operator's REST and MCP adapters. */
export function hostedCommandsDataPlugin(requests: WorkflowRequests, resolve: Resolve) {
  return {
    inject: ['data'],
    /** Route all durable commands through the same authorized project binding. */
    apply(context: Context) {
      context.effect(() =>
        context.data.register({
          id: 'workflow-requests',
          operations: operations(requests, resolve),
        }),
      );
    },
  };
}
