import type { Context } from 'cordis';
import { readObjectiveDecision } from '../../planner/src/objective-review.js';
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

type Resolve = (scope: DataScope) => Promise<
  | {
      remote: string;
      revision: string;
      documentationDirectories?: () => Promise<string[] | undefined>;
    }
  | undefined
>;

async function caller(scope: DataScope, resolve: Resolve) {
  const project = await resolve(scope);
  if (!project) throw new Error('This project has no verified hosted assignment');
  return { ...project, principal: scope.principal };
}

function operations(data: Data, requests: WorkflowRequests, resolve: Resolve) {
  return {
    current: dataOperation(z.strictObject({}), currentWorkflow, async (scope) => {
      const binding = await caller(scope, resolve);
      return currentWorkflow.parse({
        canSubmit: await data.allows(scope, resource, 'create'),
        receipt: (await requests.current(binding)) ?? null,
      });
    }),
    create: submitOperation(requests, resolve),
    read: dataOperation(workflowSelection, workflowReceipt, async (scope, { id }) =>
      workflowReceipt.parse(await requests.read(await caller(scope, resolve), id)),
    ),
    cancel: dataOperation(workflowSelection, workflowReceipt, async (scope, { id }) =>
      workflowReceipt.parse(await requests.cancel(await caller(scope, resolve), id)),
    ),
    answer: dataOperation(workflowAnswer, workflowReceipt, async (scope, input) => {
      const binding = await caller(scope, resolve);
      const receipt = await requests.read(binding, input.id);
      if (receipt.gate?.id === input.gate && receipt.gate.review)
        readObjectiveDecision(input.answer, receipt.gate.review);
      return workflowReceipt.parse(
        await requests.answer(binding, input.id, input.gate, input.answer),
      );
    }),
  };
}

function submitOperation(requests: WorkflowRequests, resolve: Resolve) {
  return dataOperation(workflowSubmission, workflowReceipt, async (scope, input) => {
    const binding = await caller(scope, resolve);
    const { request } = input;
    const draft =
      request.command === 'task_plan'
        ? request.draft
        : request.command === 'architecture_update'
          ? request.documentation
          : undefined;
    if (draft && draft.revision !== binding.revision)
      throw new Error('Refresh the project before submitting an edit from a different revision');
    const directories =
      request.command === 'task_plan' && request.mode
        ? await binding.documentationDirectories?.()
        : undefined;
    return workflowReceipt.parse(
      await requests.submit(binding, input.id, request, binding.revision, directories),
    );
  });
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
