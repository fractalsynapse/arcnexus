import type { Agent } from '../../agent/src/index.js';
import type {
  ActivitySelection,
  AgentInspection,
  TaskContext,
} from '../../architecture/src/index.js';
import { codex } from './codex.js';
import { candidateDiff } from './git.js';
import { verifyNativeGuidance } from './host-config.js';
import type { HostTask } from './index.js';
import { ResearchInbox } from './research.js';
import { Clarifications } from './clarifications.js';
import { ActivationTools } from './activation-tools.js';
import { LocalMcp } from './mcp.js';

/** Activate and resume an actor with the captured workspace and native request builder. */
export function activateActor(
  task: HostTask,
  agent: Agent,
  selection: ActivitySelection,
  data: Omit<TaskContext, 'goal' | 'worktree'>,
  signal: AbortSignal,
) {
  const { capture } = task;
  const worktree = task.worktree ?? capture.source.root;
  verifyNativeGuidance(capture, worktree);
  const diff =
    task.branch && selection.activity === 'review'
      ? task.store('activity.diff', candidateDiff(worktree, capture.source.revision))
      : undefined;
  const evidence = diff ? [...(data.evidence ?? []), diff] : data.evidence;
  const inbox = new ResearchInbox(
    task,
    (selected, input) =>
      agent.activate(
        { capture, selection: selected, task: { ...input, goal: activationGoal(task), worktree } },
        (view, cancellation) => invokeCodex(task, view, input, cancellation),
        signal,
      ),
    signal,
  );
  return new Clarifications(task, selection, signal).run({ ...data, evidence }, (input) =>
    inbox.run(selection, input),
  );
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
    recordInvocation(task, view);
    const reply = await codex(task.config.executable, view, task.artifact('codex.jsonl'), signal, {
      schema,
      url,
    });
    return actions.finish(reply);
  } catch (error) {
    if (!signal.aborted && actions.requestedHandoff) return actions.finish(undefined);
    throw error;
  } finally {
    await server.close();
  }
}

/** Record attempted native input size and identity before provider effects, without copying its text. */
function recordInvocation(task: HostTask, view: AgentInspection) {
  const profile = task.capture.components[view.component]?.activities[view.activity]?.profile;
  task.note({
    nativeInvocation: {
      inputBytes: Buffer.byteLength(view.request.input, 'utf8'),
      component: view.component,
      activity: view.activity,
      model: view.request.options.model,
      profile,
    },
  });
}

/** Stamp each tool observation with the native activation identity. */
function localTools(task: HostTask, view: AgentInspection, actions: ActivationTools) {
  const { tools } = view.request.options;
  return new LocalMcp(
    tools,
    (tool, args) => actions.invoke(tool, args),
    (name, refusal) =>
      task.note({
        operation: { component: view.component, activity: view.activity, name, refusal },
      }),
  );
}
