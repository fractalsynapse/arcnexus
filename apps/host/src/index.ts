import type { RuntimeImage } from '../../../packages/foundation/src/runtime-image.js';
import type { Context } from 'cordis';
import type { GitHubCredential } from '../../../packages/collaboration/src/index.js';
export { runHostedRequest } from './request-worker.js';
export { serveHostedRequests } from './request-loop.js';
import {
  coordinationPlugin,
  hostedProjectCoordination,
  type HostedProject,
} from '../../../packages/coordination/src/index.js';
import { direct, track } from '../../../packages/direction/src/index.js';
import { integrate, resume } from '../../../packages/delivery/src/index.js';
import {
  applicationStorage,
  hostTask,
  executionPluginFor,
  steward,
} from '../../../packages/execution/src/index.js';
import { plannerPlugin } from '../../../packages/planner/src/index.js';
import { verify } from '../../../packages/verification/src/index.js';
import { workflowPlugin, type WorkflowServices } from '../../../packages/workflow/src/index.js';

/** Compose the native Host using the selected application storage. */
export function hostPlugin(storage = applicationStorage()) {
  return mountHost(storage, coordinationPlugin(storage));
}

/** Use a PostgreSQL writer with the same Execution and Workflow plugins. */
export function hostedHostPlugin(
  storage: string,
  assignment: HostedProject & { runtime?: RuntimeImage; github?: GitHubCredential },
) {
  return mountHost(
    storage,
    (context) => context.provide('coordination', hostedProjectCoordination(assignment)),
    assignment.runtime,
    assignment.github,
  );
}

function mountHost(
  storage: string,
  coordination: (context: Context) => unknown,
  runtime?: RuntimeImage,
  github?: GitHubCredential,
) {
  return async (context: Context) => {
    await context.use(coordination);
    await context.use(executionPluginFor(storage, runtime, github));
    await context.use(plannerPlugin);
    await context.use(nativeWorkflow);
  };
}

const nativeWorkflow = {
  inject: ['agent', 'architecture', 'execution', 'planner'],
  /** Bind the workflow after Cordis has activated its native dependencies. */
  async apply(context: Context) {
    await context.use(workflowPlugin(services(context)));
  },
};

/** Map the workflow ports directly to their native owning services. */
function services(context: Context): WorkflowServices {
  return {
    execution: context.execution,
    architecture: {
      propose: (session, feedback, signal) =>
        context.architecture.propose(context.agent, hostTask(session), feedback, signal),
    },
    planner: context.planner,
    direction: {
      track,
      plan: (session, signal, standing) => direct(context.agent, session, signal, { standing }),
      revise: (session, plan, feedback, signal, standing) =>
        direct(context.agent, session, signal, { plan, feedback, standing }),
    },
    agent: {
      execute: (session, milestone, activity, signal) =>
        steward(context.agent, session, milestone, activity, signal),
    },
    verification: {
      assess: (session, plan, candidate, signal) =>
        verify(context.agent, session, plan, candidate, signal),
    },
    delivery: { integrate, resume },
  };
}
