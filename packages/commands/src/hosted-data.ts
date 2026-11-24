import type { Context } from 'cordis';
import { z } from 'zod';
import { dataOperation, type Data, type DataScope } from '../../data/src/index.js';
import type { WorkflowRequests } from '../../coordination/src/index.js';
import {
  currentWorkflow,
  workflowAnswer,
  workflowReceipt,
  workflowSelection,
  workflowSubmission,
} from './browser.js';

const resource = 'workflow-requests';

type Resolve = (scope: DataScope) => Promise<{ remote: string; revision: string } | undefined>;

async function caller(scope: DataScope, resolve: Resolve) {
  const project = await resolve(scope);
  if (!project) throw new Error('This project has no verified hosted assignment');
  return { ...project, principal: scope.principal };
}

function operations(data: Data, requests: WorkflowRequests, resolve: Resolve) {
  return {
    current: dataOperation(z.strictObject({}), currentWorkflow, async (scope) =>
      currentWorkflow.parse({
        canSubmit: await data.allows(scope, resource, 'create'),
        receipt: (await requests.current(await caller(scope, resolve))) ?? null,
      }),
    ),
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
      const data = context.data;
      context.effect(() =>
        data.register({
          id: resource,
          operations: operations(data, requests, resolve),
        }),
      );
    },
  };
}
