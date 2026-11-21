import { Clarifications, HostTask, type HoldContext } from '../../execution/src/index.js';
import { ClarificationRequired, type ActivityCheckpoint, type TaskSession } from './services.js';

/** Reobserve a retained gate through the host before any dependent activation or checked effect. */
export async function releasedReviewedPrerequisite(
  session: TaskSession,
  activation: ActivityCheckpoint,
  signal: AbortSignal,
) {
  const outcome = activation.outcome;
  const held = outcome.kind === 'blocked' ? outcome.holdContext : undefined;
  if (!held?.prerequisite || !(session instanceof HostTask)) return false;
  if (
    held.task.id !== session.taskID ||
    held.task.authority !== session.capture.source.revision ||
    !session.worktree
  )
    return false;
  if (held.prerequisite.kind === 'dependencies') {
    const check = held.failure.check;
    if (!check) return false;
    const observed = await session.check(check.id, signal, {
      owner: activation.owner,
      activity: activation.step,
      expected: held.failure.expected,
    });
    if (observed.prerequisite || typeof observed.status !== 'number') return false;
    return !held.gates.length || resolveHumanGates(session, activation, held, signal);
  }
  return resolveHumanGates(session, activation, held, signal);
}

/** Resolve every retained caller question in its original inbox, preserving complete host answers. */
async function resolveHumanGates(
  task: HostTask,
  activation: ActivityCheckpoint,
  held: HoldContext,
  signal: AbortSignal,
) {
  const selection = { component: activation.owner, activity: activation.step };
  const data = { milestone: { id: held.milestone }, acceptance: held.acceptance };
  const step = task
    .history()
    .findLast((event) => 'plan' in event)
    ?.plan?.milestones.find((milestone) => milestone.id === held.milestone)
    ?.steps.find((step) => step.activity === activation.step);
  const contexts = [data, { ...data, milestone: { ...data.milestone, step } }];
  if (!held.gates.length) return false;
  for (const gate of held.gates) {
    const context = contexts.find((data) => task.inboxScope(selection, data) === gate.scope);
    if (!context) return false;
    try {
      await new Clarifications(task, selection, signal).run(context, async () => undefined);
    } catch (error) {
      if (signal.aborted || !(error instanceof ClarificationRequired)) throw error;
      return false;
    }
  }
  return true;
}
