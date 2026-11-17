import type { ActivityCheckpoint } from '../../workflow/src/index.js';
import { editFingerprint, type ObservedEdit } from './edits.js';
import type { HostTask } from './index.js';
import { git } from './git.js';

interface CommitCheckpoint {
  readonly head: string;
  readonly previous: string;
  readonly parent: string;
  readonly activity?: ActivityCheckpoint;
}

interface CheckpointEvent {
  checkpoint?: CommitCheckpoint;
  confirmed?: string;
  editIntent?: readonly ObservedEdit[];
  owner?: string;
}

/** Commit checked work and move the activity cursor only after the remote checkpoint is observed. */
export async function checkpoint(
  task: HostTask,
  activity: ActivityCheckpoint,
  signal: AbortSignal,
) {
  const save = saveCheckpoint(task, activity);
  if (save) await reconcileCheckpoint(task, signal);
  else task.note({ activation: activity });
}

/** Protect checked edits before a workspace is removed, including failure during an operation. */
export function saveCheckpoint(task: HostTask, activity?: ActivityCheckpoint) {
  const { worktree, branch, issue } = task;
  if (!worktree || !branch || !issue || !git(worktree, 'status', '--porcelain')) return undefined;
  validateCheckedChanges(task, worktree);
  git(worktree, 'add', '-A', '--', '.');
  const parent = git(worktree, 'rev-parse', 'HEAD');
  const tree = git(worktree, 'write-tree');
  const scope = activity ? `${activity.owner}/${activity.step}` : 'interrupted checked edits';
  const head = git(
    worktree,
    'commit-tree',
    tree,
    '-p',
    parent,
    '-m',
    `chore: checkpoint ${scope} (#${issue})`,
  );
  const previous =
    task.observations<CheckpointEvent>().findLast(({ checkpoint }) => checkpoint)?.checkpoint
      ?.head ?? '';
  const saved = { head, parent, previous, activity };
  task.note({ checkpoint: saved });
  git(worktree, 'update-ref', `refs/heads/${branch}`, head, parent);
  return saved;
}

/** Reconcile all recorded commits in order, observing a prior push before any repeated mutation. */
export async function reconcileCheckpoint(task: HostTask, signal: AbortSignal) {
  const { branch } = task;
  if (!branch) throw new Error('Checkpoint requires an issue branch');
  const events = task.observations<CheckpointEvent>();
  const index = events.findLastIndex(({ confirmed }) => confirmed);
  const last = events[index]?.confirmed;
  const pending = events
    .slice(index + 1)
    .flatMap(({ checkpoint }) => (checkpoint ? [checkpoint] : []));
  if (pending.length) {
    for (const saved of pending) {
      await observeCheckpoint(task, branch, saved, signal);
      task.note({
        confirmed: saved.head,
        ...(saved.activity ? { activation: saved.activity } : {}),
      });
    }
    return;
  }
  const saved = events.findLast(({ checkpoint }) => checkpoint?.head === last)?.checkpoint;
  if (saved) await observeCheckpoint(task, branch, { ...saved, previous: saved.head }, signal);
  else if (await task.provider(signal).remoteHead(branch))
    throw new Error(`Untracked issue branch already exists: ${branch}`);
}

/** Observe the exact ref, then use its observed head as the lease for an authorized push. */
async function observeCheckpoint(
  task: HostTask,
  branch: string,
  saved: CommitCheckpoint,
  signal: AbortSignal,
) {
  const provider = task.provider(signal);
  const observed = await provider.remoteHead(branch);
  if (observed && observed !== saved.head && observed !== saved.previous)
    throw new Error(`Remote checkpoint changed for ${branch}`);
  if (observed === saved.head) ensureObject(task, branch, saved.head);
  ensureLocal(task, branch, saved);
  if (observed === saved.head) return;
  await provider.push(task.capture.source.root, branch, saved.head, observed);
  if ((await provider.remoteHead(branch)) !== saved.head)
    throw new Error(`GitHub did not confirm checkpoint ${saved.head}`);
}

/** Fetch a recorded checkpoint object if the local ref and workspace were removed. */
function ensureObject(task: HostTask, branch: string, commit: string) {
  const { root } = task.capture.source;
  try {
    git(root, 'cat-file', '-e', `${commit}^{commit}`);
  } catch {
    git(root, 'fetch', '--no-tags', 'origin', `refs/heads/${branch}`);
    if (git(root, 'rev-parse', 'FETCH_HEAD^{commit}') !== commit)
      throw new Error(`Remote checkpoint changed while fetching ${branch}`);
  }
}

/** Reattach a saved commit only when the local reference is absent, unchanged, or its recorded parent. */
function ensureLocal(task: HostTask, branch: string, checkpoint: CommitCheckpoint) {
  const root = task.capture.source.root;
  const ref = `refs/heads/${branch}`;
  const current = git(root, 'for-each-ref', '--format=%(objectname)', ref);
  if (current === checkpoint.head) return;
  if (current && current !== checkpoint.parent)
    throw new Error(`Local checkpoint branch changed for ${branch}`);
  git(root, 'update-ref', ref, checkpoint.head, current || '0'.repeat(40));
}

/** Refuse unexpected local bytes before staging a workspace checkpoint. */
function validateCheckedChanges(task: HostTask, worktree: string) {
  const changes = [
    git(worktree, 'diff', 'HEAD', '--name-only', '--no-renames', '-z'),
    git(worktree, 'ls-files', '--others', '--exclude-standard', '-z'),
  ]
    .flatMap((list) => list.split('\0'))
    .filter(Boolean);
  const events = task.observations<CheckpointEvent>();
  const intents = events.slice(events.findLastIndex(({ checkpoint }) => checkpoint) + 1);
  for (const path of new Set(changes)) {
    const intent = intents.findLast(({ editIntent }) =>
      editIntent?.some((edit) => edit.path === path),
    );
    const edit = intent?.editIntent?.find((entry) => entry.path === path);
    if (
      !intent?.owner ||
      !edit ||
      editFingerprint(worktree, task.capture, intent.owner, path) !== edit.after
    )
      throw new Error(`Unrecorded contents in task checkpoint: ${path}`);
  }
}
