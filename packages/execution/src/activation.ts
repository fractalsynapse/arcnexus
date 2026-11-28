import { rmSync } from 'node:fs';
import { InvalidAgentResponse, type Agent } from '../../agent/src/index.js';
import type {
  ActivitySelection,
  AgentInspection,
  TaskContext,
} from '../../architecture/src/index.js';
import type { CompletedRefinementRound } from '../../workflow/src/index.js';
import { candidateDiff } from './git.js';
import { verifyNativeGuidance } from './host-config.js';
import type { HostTask } from './index.js';
import { callerRevision, ResearchInbox } from './research.js';
import { Clarifications } from './clarifications.js';
import { ActivationTools } from './activation-tools.js';
import { LocalMcp } from './mcp.js';
import { retainedEvidence } from './context-evidence.js';
import { NativeObservation } from './native-observation.js';
import { checkFailureSignature, stewardInput, verifyActivity } from './steward-check.js';

type ActivityData = Omit<TaskContext, 'worktree'>;
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
  if (data.capturedDocumentation)
    return activateCapturedDocuments(task, agent, selection, data, signal);
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
  const revision = callerRevision(task, selection);
  return new Clarifications(task, selection, signal, revision).run({ ...data, evidence }, (input) =>
    inbox.run(selection, input),
  );
}

/** Run the recommendation against pinned Git objects from a neutral directory. */
async function activateCapturedDocuments(
  task: HostTask,
  agent: Agent,
  selection: ActivitySelection,
  data: ActivityData,
  signal: AbortSignal,
) {
  const worktree = task.documentationWorkspace();
  const context = { ...data, worktree, goal: task.goal };
  try {
    return await agent.activate(
      { capture: task.capture, selection, task: context },
      (view, cancellation) => {
        const options = view.request.options;
        const tools = options.tools.filter(
          ({ handler }) => handler === 'read' || handler === 'list',
        );
        const request = {
          ...view.request,
          options: { ...options, tools, webSearchMode: 'disabled' },
        };
        return invokeCodex(task, { ...view, request }, context, cancellation);
      },
      signal,
    );
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
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
    const reply = await agent.activate(
      { capture: task.capture, selection, task: context },
      (view, cancellation) => invokeCodex(task, view, context, cancellation),
      signal,
    );
    await verifyActorCompletion(task, selection, reply, signal);
    return reply;
  };
}

/** Preserve explicit initial input and add current indexed history only when resuming an actor. */
function invocationContext(task: HostTask, current: ActivityData, observed?: number): TaskContext {
  const context = {
    ...current,
    goal: activationGoal(task, current.goal),
    worktree: task.worktree ?? task.capture.source.root,
  };
  const retained = completedRoundContext(task, context.assignment);
  context.assignment = retained.assignment;
  context.evidence = [...new Set([...(context.evidence ?? []), ...retained.evidence])];
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

/** Add compact round references and readable registered sources to the prepared observation. */
function completedRoundContext(task: HostTask, assignment: unknown) {
  const rounds = task.journal.completedRounds().flatMap((event) => {
    const { completedRound: round } = event.observation as {
      completedRound?: CompletedRefinementRound;
    };
    return typeof round?.report === 'string' && task.journal.artifactRecorded(round.report)
      ? [{ invocation: round.invocation, round: round.round, report: round.report }]
      : [];
  });
  const instructions =
    typeof assignment === 'object' && assignment !== null
      ? assignment
      : assignment === undefined
        ? {}
        : { instructions: assignment };
  const timelines = [task.parent?.timeline, task.timeline].filter(
    (path): path is string => path !== undefined && task.journal.artifactRecorded(path),
  );
  return {
    assignment: rounds.length ? { ...instructions, completedRounds: rounds } : assignment,
    evidence: [...rounds.map(({ report }) => report), ...timelines],
  };
}

/** Scope an actor's instructions without changing the task's canonical retry identity. */
function activationGoal(task: HostTask, goal?: string) {
  const approved = task.guide;
  return approved
    ? `Implement and deliver the exact human-approved architecture batch and its prerequisites.\n\n${approved.proposal.purpose}`
    : (goal ?? task.goal);
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

/** Enforce declared Architect completion before its caller can retain an assessment or approval proposal. */
async function verifyActorCompletion(
  task: HostTask,
  selection: ActivitySelection,
  reply: unknown,
  signal: AbortSignal,
) {
  const architect = task.capture.project.architect;
  if (
    architect?.component !== selection.component ||
    architect.activity !== selection.activity ||
    !['proposal', 'no-change'].includes(String((reply as { kind?: unknown } | null)?.kind))
  )
    return;
  const scope = { owner: selection.component, activity: selection.activity };
  const failed = await verifyActivity(task, scope, signal);
  if (!failed) return;
  const diagnostic =
    failed.diagnostic ??
    `Operation ${failed.id} exited ${failed.status}; expected ${failed.expected}`;
  throw new InvalidAgentResponse(`${diagnostic}; read failed check log: ${failed.log}`, {
    identity: JSON.stringify([
      scope,
      failed.id,
      checkFailureSignature(failed.log),
      stewardInput(task.observations()),
    ]),
  });
}
