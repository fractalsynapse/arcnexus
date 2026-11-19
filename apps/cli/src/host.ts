import type { Context } from 'cordis';
import { coordinationPlugin, revisionSnapshot } from '../../../packages/coordination/src/index.js';
import { direct, track, type RevisionRequest } from '../../../packages/direction/src/index.js';
import { integrate, resume } from '../../../packages/delivery/src/index.js';
import {
  applicationStorage,
  executionPlugin,
  hostTask,
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
      revise: (session, _plan, feedback, signal, standing) => {
        const task = hostTask(session);
        const snapshot = revisionSnapshot(task.observations());
        const revision: RevisionRequest = {
          acceptedPlan: task.store('accepted-plan.json', JSON.stringify(snapshot.plan)),
          retainedEvidence: task.store(
            'retained-evidence.json',
            JSON.stringify(snapshot.observations),
          ),
          position: snapshot.position,
          finding: feedback.kind === 'plan-repair' ? feedback.original! : feedback,
        };
        return direct(context.agent, session, signal, { revision, feedback, standing });
      },
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
