import type { Agent } from '../../agent/src/index.js';
import type { ActivitySelection, TaskContext } from '../../architecture/src/index.js';
import { codex } from './codex.js';
import { candidateDiff } from './git.js';
import { verifyNativeGuidance } from './host-config.js';
import type { HostTask } from './index.js';
import { ResearchInbox } from './research.js';

/** Activate and resume an actor with the captured workspace and native request builder. */
export function activateActor(
  task: HostTask,
  agent: Agent,
  selection: ActivitySelection,
  data: Omit<TaskContext, 'goal' | 'worktree'>,
  signal: AbortSignal,
) {
  const { capture, goal } = task;
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
        { capture, selection: selected, task: { ...input, goal, worktree } },
        (view, cancellation) =>
          codex(task.config.executable, view, task.artifact('codex.jsonl'), cancellation),
        signal,
      ),
    signal,
  );
  return inbox.run(selection, { ...data, evidence });
}
