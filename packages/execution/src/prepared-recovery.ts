import { git } from './git.js';
import { validateRetainedWork } from './architecture-adoption.js';
import type { HostTask } from './index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { Publication } from '../../delivery/src/index.js';

interface Checkpoint {
  head: string;
  previous: string;
  parent: string;
}

interface History {
  baseRevision?: string;
  publication?: Publication;
  candidate?: Candidate;
  verdict?: Verdict;
  checkpoint?: Checkpoint;
  confirmed?: string;
}

/** Permit repair of an observed open PR only when it belongs to a recorded accepted publication. */
export async function observePreparedPublication(task: HostTask, signal: AbortSignal) {
  const pull = await task.provider(signal).publication(task.branch!);
  if (!pull) return;
  const history = task.observations<History>();
  const publication = history.findLast((event) => event.publication)?.publication;
  const accepted = history.findLast((event) => event.verdict?.kind === 'accepted');
  const confirmed = history.findLast((event) => event.confirmed)?.confirmed;
  if (
    !publication ||
    publication.branch !== task.branch ||
    publication.issue !== task.issue ||
    pull.state !== 'open' ||
    pull.target !== publication.target ||
    publication.target !== task.config.base ||
    accepted?.candidate?.digest !== publication.candidate ||
    accepted.verdict?.kind !== 'accepted' ||
    accepted.verdict.candidate !== publication.candidate ||
    (pull.head !== publication.head && pull.head !== confirmed)
  )
    throw new Error('An existing pull request must match a retained accepting publication');
  task.note({ publicationObserved: { branch: task.branch, pull } });
}

/** Confirm the admission and recover compatible prepared work through its existing checkpoint. */
export async function recoverPrepared(task: HostTask, signal: AbortSignal) {
  if (!task.config.fresh) throw new Error('The task does not have a verified current staging base');
  const history = task.observations<History>();
  const before = history.findLast(({ baseRevision }) => baseRevision)?.baseRevision;
  const { revision, root } = task.capture.source;
  if (!before || before === revision) return;
  const parent = await observedCheckpoint(task, before, history, signal);
  validateRetainedWork(task, task.capture);
  const tree = mergeCheckpoint(root, parent, revision);
  const head = git(
    root,
    'commit-tree',
    tree,
    '-p',
    parent,
    '-p',
    revision,
    '-m',
    `chore: reconcile prepared checkpoint with staging (#${task.issue})`,
  );
  task.note({ checkpoint: { head, parent, previous: parent }, baseRevision: revision });
}

/** Require an already secured branch and the exact observed staging head before preparing recovery. */
async function observedCheckpoint(
  task: HostTask,
  before: string,
  history: readonly History[],
  signal: AbortSignal,
) {
  const { root, revision } = task.capture.source;
  const checkpoint = history.findLast((event) => event.checkpoint)?.checkpoint;
  const confirmed = history.findLast((event) => event.confirmed)?.confirmed;
  const ref = `refs/heads/${task.branch}`;
  const branch = git(root, 'for-each-ref', '--format=%(objectname)', ref);
  if (!checkpoint || checkpoint.head !== confirmed || branch !== confirmed)
    throw new Error('Moved staging recovery needs the same secured local checkpoint');
  if (git(root, 'worktree', 'list', '--porcelain').split('\n').includes(`branch ${ref}`))
    throw new Error('Moved staging recovery needs the task worktree removed after its checkpoint');
  if (git(root, 'merge-base', checkpoint.head, revision) !== before)
    throw new Error('Moved staging does not descend from the retained checkpoint base');
  const provider = task.provider(signal);
  if ((await provider.remoteHead(task.branch!)) !== checkpoint.head)
    throw new Error('The observed issue branch differs from its secured checkpoint');
  if ((await provider.remoteHead(task.config.base)) !== revision)
    throw new Error('Staging changed while preparing checkpoint recovery');
  return checkpoint.head;
}

/** Merge retained changes normally and preserve Git's complete conflict output without moving a ref. */
function mergeCheckpoint(root: string, checkpoint: string, revision: string) {
  try {
    return git(root, 'merge-tree', '--write-tree', checkpoint, revision);
  } catch (error) {
    const failure = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    const details = [failure.message, failure.stdout?.toString(), failure.stderr?.toString()];
    throw new Error(details.filter(Boolean).join('\n'), { cause: error });
  }
}
