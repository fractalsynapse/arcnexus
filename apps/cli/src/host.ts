import type { Context } from 'cordis';
import { coordinationPlugin } from '../../../packages/coordination/src/index.js';
import { direct, track } from '../../../packages/direction/src/index.js';
import { integrate, resume } from '../../../packages/delivery/src/index.js';
import {
  applicationStorage,
  executionPlugin,
  steward,
} from '../../../packages/execution/src/index.js';
import { plannerPlugin } from '../../../packages/planner/src/index.js';
import { verify } from '../../../packages/verification/src/index.js';
import { workflowPlugin, type WorkflowServices } from '../../../packages/workflow/src/index.js';

/** Compose the production services only for an admitted task command. */
export async function mountTaskHost(context: Context) {
  await context.use(coordinationPlugin(applicationStorage()));
  await context.use(executionPlugin);
  await context.use(plannerPlugin);
  await context.use(workflowPlugin(services(context)));
}

/** Map the workflow ports directly to their native owning services. */
function services(context: Context): WorkflowServices {
  return {
    execution: context.execution,
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
