import type { Agent } from '../../agent/src/index.js';
import type {
  ActivitySelection,
  AgentInspection,
  TaskContext,
} from '../../architecture/src/index.js';
import { candidateDiff } from './git.js';
import { verifyNativeGuidance } from './host-config.js';
import type { HostTask } from './index.js';
import { ResearchInbox } from './research.js';
import { Clarifications } from './clarifications.js';
import { ActivationTools } from './activation-tools.js';
import { LocalMcp } from './mcp.js';
import { retainedEvidence } from './context-evidence.js';
import { NativeObservation } from './native-observation.js';

type ActivityData = Omit<TaskContext, 'goal' | 'worktree'>;
export type ContextRefresh = (input: ActivityData) => Promise<ActivityData>;

/** Activate and resume an actor with the captured workspace and native request builder. */
export function activateActor(
  task: HostTask,
  agent: Agent,
  selection: ActivitySelection,
  data: ActivityData,
  signal: AbortSignal,
  refresh?: ContextRefresh,
) {
  const { capture } = task;
  const worktree = task.worktree ?? capture.source.root;
  verifyNativeGuidance(capture, worktree);
  const diff =
    task.branch && selection.activity === 'review'
      ? task.store('activity.diff', candidateDiff(worktree, task.config.capture.source.revision))
      : undefined;
  const evidence = diff ? [...(data.evidence ?? []), diff] : data.evidence;
  const inbox = new ResearchInbox(
    task,
    actorInvoker(task, agent, selection, signal, refresh),
    signal,
  );
  return new Clarifications(task, selection, signal).run({ ...data, evidence }, (input) =>
    inbox.run(selection, input),
  );
}

/** Refresh only the returning original caller while preserving inbox-owned answer enrichment. */
function actorInvoker(
  task: HostTask,
  agent: Agent,
  original: ActivitySelection,
  signal: AbortSignal,
  refresh?: ContextRefresh,
) {
  let invoked = false;
  let observed = task.evidence.length;
  return async (selection: ActivitySelection, input: ActivityData) => {
    const caller =
      selection.component === original.component && selection.activity === original.activity;
    const current = caller && invoked && refresh ? await refresh(input) : input;
    const context = invocationContext(task, current, invoked ? observed : undefined);
    observed = task.evidence.length;
    if (caller) invoked = true;
    return agent.activate(
      { capture: task.capture, selection, task: context },
      (view, cancellation) => invokeCodex(task, view, context, cancellation),
      signal,
    );
  };
}

/** Preserve explicit initial input and add current indexed history only when resuming an actor. */
function invocationContext(task: HostTask, current: ActivityData, observed?: number): TaskContext {
  const context = {
    ...current,
    goal: activationGoal(task),
    worktree: task.worktree ?? task.capture.source.root,
  };
  const reports = task.journal.completedRounds().flatMap((event) => {
    const observation = event.observation as { completedRound?: { report?: unknown } };
    const report = observation.completedRound?.report;
    return typeof report === 'string' && task.journal.artifactRecorded(report) ? [report] : [];
  });
  context.evidence = [...new Set([...(context.evidence ?? []), ...reports])];
  if (task.timeline) context.evidence = [...context.evidence, task.timeline];
  if (observed !== undefined)
    context.evidence = [
      ...new Set([
        ...(context.evidence ?? []),
        ...retainedEvidence(task),
        ...task.evidence.slice(observed),
      ]),
    ];
  return context;
}

/** Use the verified delivery purpose for prerequisite actors while preserving canonical retry identity. */
function activationGoal(task: HostTask) {
  const approved = task.guide;
  return approved
    ? `Implement and deliver the exact human-approved architecture batch and its prerequisites.\n\n${approved.proposal.purpose}`
    : task.goal;
}

/** Store a host-generated response schema next to the protected transcript. */
async function invokeCodex(
  task: HostTask,
  view: AgentInspection,
  input: TaskContext,
  signal: AbortSignal,
) {
  const { outputSchema } = view.request.options;
  const schema = outputSchema
    ? task.store('codex-output-schema.json', JSON.stringify(outputSchema))
    : undefined;
  const actions = new ActivationTools(task, view, input, signal);
  if (actions.requestedHandoff) return actions.finish(undefined);
  const server = localTools(task, view, actions);
  const url = await server.start();
  try {
    const observation = new NativeObservation(task, view);
    const reply = await observation.run(schema, url, signal);
    return actions.finish(reply);
  } catch (error) {
    if (!signal.aborted && actions.requestedHandoff) return actions.finish(undefined);
    throw error;
  } finally {
    await server.close();
  }
}

/** Stamp each tool observation with the native activation identity. */
function localTools(task: HostTask, view: AgentInspection, actions: ActivationTools) {
  const { tools } = view.request.options;
  return new LocalMcp(
    tools,
    (tool, args) => actions.invoke(tool, args),
    (name, refusal, event) => {
      const source = task.store(
        'mcp-observation.json',
        JSON.stringify({ name, refusal, ...event }),
      );
      task.note(
        {
          operation: {
            component: view.component,
            activity: view.activity,
            name,
            refusal,
            call: event?.call,
            phase: event?.phase,
            durationMs: event?.durationMs,
            source,
          },
        },
        event,
      );
    },
  );
}
