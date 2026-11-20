import assert from 'node:assert/strict';
import { activities } from '../../../direction/src/index.js';
import { hostTask } from '../../../execution/src/index.js';
import type { TaskSession, WorkflowServices } from '../../src/index.js';
import { RefinementPlanner } from './refinement-planner.js';

/** Exercise Architect's actual inbox and the normal nested task lifecycle with controlled actors. */
export class RefinementSupplier {
  readonly provider: RefinementPlanner;
  readonly architectTasks = new Set<string>();
  readonly childTasks = new Set<string>();

  /** Keep native supplier attempts distinguishable from the outer Planner observations. */
  constructor(revision: string) {
    this.provider = new RefinementPlanner(revision, true, { component: 'supplier', activity: 'implementation' });
    this.provider.attempts = 10;
  }

  /** Bind explicit actor responses while leaving Workflow admission, cursor and cleanup real. */
  bind(services: WorkflowServices, planner: RefinementPlanner) {
    services.architecture!.propose = async (session) => {
      planner.observe(session);
      this.architectTasks.add(hostTask(session).taskID);
      if (!hostTask(session).observations<{ projectReply?: unknown }>().some((event) => event.projectReply))
        return { kind: 'supplier', scope: 'assessment', owner: 'supplier', question: 'Explain the nested finding completely', evidence: [] };
      return { kind: 'no-change', summary: 'Architect consumed the complete supplier answer', evidence: [] };
    };
    const planGoal = services.direction.plan;
    services.direction.plan = async (session, signal, standing) => {
      if (!hostTask(session).inbox) return planGoal(session, signal, standing);
      this.childTasks.add(hostTask(session).taskID);
      return supplierPlan();
    };
    services.agent.execute = (session, _milestone, _activity, signal) => this.answer(session, signal);
    services.execution.checkpoint = async (session, activation) => session.record({ activation });
    services.verification.assess = async (_session, plan, candidate) => ({
      kind: 'accepted', candidate: candidate.digest,
      criteria: plan.milestones.flatMap(({ criteria }) => criteria.map(({ id }) => id)), evidence: [],
    });
  }

  /** Obtain complete findings and answers from the real native observation and clarification path. */
  private async answer(session: TaskSession, signal: AbortSignal) {
    hostTask(session).planningWorkspace(signal);
    const result = await this.provider.propose(session, undefined, undefined, signal);
    assert.match(result.summary, /Provider finding attempt/);
    return { kind: 'completed' as const, answer: result.summary, evidence: [] };
  }
}

/** Supply a valid Director plan for the accountable supplier's read-only answer. */
function supplierPlan() {
  return { kind: 'plan', plan: {
    focus: { purpose: 'Answer Architect', objectives: ['Retain the complete answer'], constraints: ['Read only'] },
    milestones: [{
      id: 'answer', owner: 'supplier', criteria: [{ id: 'answer', description: 'Complete answer' }],
      steps: activities.map((activity) => ({
        activity,
        ...(activity === 'implementation'
          ? { checklist: [{ id: 'answer', criteria: ['answer'], expected: 'Return the full finding and answer' }] }
          : { checklist: [], inapplicable: 'Read-only answer fixture' }),
      })),
    }],
  }};
}
