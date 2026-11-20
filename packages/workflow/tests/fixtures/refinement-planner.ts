import { Agent } from '../../../agent/src/index.js';
import type {
  AgentInspection,
  Architecture,
  TaskContext,
} from '../../../architecture/src/index.js';
import { hostTask } from '../../../execution/src/index.js';
import type { TaskSession } from '../../src/index.js';

/** Drive explicit provider attempts through HostTask activation, native pipes and durable answers. */
export class RefinementPlanner {
  attempts = 0;
  round = 1;
  readonly tasks = new Map<number, Set<string>>([
    [1, new Set()],
    [2, new Set()],
  ]);
  readonly identities: string[] = [];

  /** Bind the captured revision to justified read-only Planner outcomes. */
  constructor(
    private readonly revision: string,
    private readonly unfinished = true,
  ) {}

  /** Register each phase or goal session so assertions can independently read canonical history. */
  observe(session: TaskSession) {
    this.tasks.get(this.round)!.add(hostTask(session).taskID);
  }

  /** Resume the same unfinished child, retaining the answer while changing provider findings. */
  async propose(session: TaskSession, _mode: unknown, _report: unknown, signal: AbortSignal) {
    const attempt = ++this.attempts;
    this.round = this.unfinished ? (attempt < 3 ? 1 : 2) : attempt;
    this.observe(session);
    this.identities.push(hostTask(session).taskID);
    const agent = new Agent({
      request: (_capture: unknown, _selection: unknown, task: TaskContext) =>
        providerView(session, task),
    } as unknown as Architecture);
    const reply = (await hostTask(session).activate(
      agent,
      { component: 'planner', activity: 'planning' },
      { assignment: { attempt }, acceptance: [] },
      signal,
    )) as { finding: string; answer: string };
    return {
      kind: 'planned' as const,
      commit: this.revision,
      summary: reply.finding + '\n' + reply.answer,
      evidence: [],
    };
  }
}

/** Supply a controlled prepared request without substituting the native observation path. */
function providerView(session: TaskSession, task: TaskContext): AgentInspection {
  return {
    component: 'planner',
    activity: 'planning',
    placeholders: [],
    request: {
      input: JSON.stringify(task.assignment),
      options: {
        workingDirectory: session.capture.source.root,
        model: 'fixture-model',
        modelReasoningEffort: 'high',
        webSearchMode: 'disabled',
        tools: [
          {
            name: 'ask-question',
            handler: 'question',
            description: 'Ask the human',
            inputSchema: {
              type: 'object',
              required: ['question'],
              properties: { question: { type: 'string' } },
              additionalProperties: false,
            },
          },
        ],
      },
    },
  } as unknown as AgentInspection;
}
