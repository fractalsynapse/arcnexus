import { parse } from 'yaml';
import { git } from './git.js';
import { isNativeGuidance, isTargetCodexConfig } from './host-config.js';
import type { HostTask } from './index.js';

interface Checkpoint {
  head: string;
  previous: string;
  parent: string;
}

interface History {
  baseRevision?: string;
  publication?: unknown;
  checkpoint?: Checkpoint;
  confirmed?: string;
}

interface Registry {
  contracts: { id: string; stage: string }[];
  [key: string]: unknown;
}

/** Confirm the admission and recover compatible prepared work through its existing checkpoint. */
export async function recoverPrepared(task: HostTask, signal: AbortSignal) {
  if (!task.config.fresh) throw new Error('The task does not have a verified current staging base');
  const history = task.observations<History>();
  const before = history.findLast(({ baseRevision }) => baseRevision)?.baseRevision;
  const { revision, root } = task.capture.source;
  if (!before || before === revision) return;
  const parent = await observedCheckpoint(task, before, history, signal);
  validateAdvance(task, before, parent);
  const tree = git(root, 'merge-tree', '--write-tree', parent, revision);
  validateTree(root, before, parent, revision, tree);
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
  if (history.some((event) => event.publication))
    throw new Error('Moved staging recovery cannot reuse a recorded publication');
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

/** Keep captured authority and all checked paths independent of the staging advance. */
function validateAdvance(task: HostTask, before: string, checkpoint: string) {
  const { source, project, contracts, standards } = task.capture;
  const staged = paths(source.root, before, source.revision);
  const edits = new Set(paths(source.root, before, checkpoint));
  const authority = new Set([
    project.planTemplate,
    ...Object.values(standards).map(({ document }) => document),
    ...contracts.filter(({ stage }) => stage === 'locked').map(({ file }) => file),
  ]);
  const conflict = staged.find((path) => edits.has(path));
  if (conflict) throw new Error(`Staging overlaps a checked path: ${conflict}`);
  const changedAuthority = staged.find(
    (path) =>
      authority.has(path) ||
      path.startsWith('.arc/architecture/') ||
      isNativeGuidance(path) ||
      isTargetCodexConfig(path),
  );
  if (changedAuthority)
    throw new Error(`Staging changed captured authority or guidance: ${changedAuthority}`);
  if (staged.includes(project.contractRegistry))
    validateRegistry(source.root, before, source.revision, project.contractRegistry);
}

/** Compare registry policy and locked contracts independently of proposed documents. */
function validateRegistry(root: string, before: string, after: string, path: string) {
  if (lockedRegistry(root, before, path) !== lockedRegistry(root, after, path))
    throw new Error(`Staging changed captured registry authority: ${path}`);
}

/** Read only registry fields that determine captured locked authority. */
function lockedRegistry(root: string, revision: string, path: string) {
  const { contracts, ...policy } = parse(git(root, 'show', `${revision}:${path}`)) as Registry;
  const locked = contracts
    .filter(({ stage }) => stage === 'locked')
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify({ policy, locked });
}

/** Return byte-preserving path identities without Git rename inference. */
function paths(root: string, before: string, after: string) {
  return git(root, 'diff', '--name-only', '--no-renames', '-z', before, after, '--')
    .split('\0')
    .filter(Boolean);
}

/** Prove each parent's changes survive byte for byte before retaining the new checkpoint. */
function validateTree(
  root: string,
  before: string,
  parent: string,
  revision: string,
  tree: string,
) {
  const patch = (from: string, to: string) =>
    git(
      root,
      'diff',
      '--binary',
      '--full-index',
      '--no-renames',
      '--no-ext-diff',
      '--no-textconv',
      from,
      to,
      '--',
    );
  if (
    patch(before, parent) !== patch(revision, tree) ||
    patch(before, revision) !== patch(parent, tree)
  )
    throw new Error('Checkpoint recovery changed validated file contents');
}
