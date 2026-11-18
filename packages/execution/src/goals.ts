import type { HostTask } from './index.js';
import type { Architecture, Capture } from '../../architecture/src/index.js';
import type { Coordination } from '../../coordination/src/index.js';
import { goalInventory } from '../../planner/src/inventory.js';
import type { GoalRound } from '../../workflow/src/index.js';
import { git, remoteRead } from './git.js';

/** Read goals from one reviewed staging revision and give this evaluation round a durable identity. */
export function goalRound(
  architecture: Architecture,
  coordination: Coordination,
  directory: string,
): GoalRound {
  const local = architecture.capture(directory);
  if (!local.project.delivery?.baseBranch && !goalInventory(local).length)
    throw new Error('No standing goals in the captured project inventory');
  const capture = stagingCapture(architecture, local);
  const remote = capture.source.remote;
  const { id, inventory } = coordination.round(remote, () => {
    const goals = goalInventory(capture);
    if (!goals.length) throw new Error('No standing goals in the captured project inventory');
    return JSON.stringify(goals);
  });
  const goals = JSON.parse(inventory) as GoalRound['goals'];
  return { id, goals, finish: () => coordination.completeRound(remote, id) };
}

/** Observe staging and materialize its exact commit only when it is absent locally. */
export function stagingCapture(
  architecture: Architecture,
  capture: Capture,
  readRemote = remoteRead,
): Capture {
  const { source, project } = capture;
  const branch = project.delivery?.baseBranch;
  if (!branch) {
    throw new Error('Task needs a staging delivery branch');
  }
  if (
    !/^[\w/-]+$/.test(branch) ||
    branch === 'main' ||
    branch === project.delivery?.protectedBranch
  )
    throw new Error('Invalid staging delivery branch');
  const ref = `refs/heads/${branch}`;
  const revision = readRemote(source.root, 'ls-remote', '--exit-code', 'origin', ref).split(
    '\t',
  )[0]!;
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid observed staging head');
  if (revision === source.revision) return capture;
  ensureStagingCommit(source.root, ref, revision, readRemote);
  const latest = architecture.capture(source.root, revision);
  if (latest.project.delivery?.baseBranch !== branch)
    throw new Error('The observed staging revision changed the configured target');
  return latest;
}

/** Fetch a new staging object and fail if the branch moved after observation. */
function ensureStagingCommit(
  root: string,
  ref: string,
  revision: string,
  readRemote: typeof remoteRead,
) {
  try {
    git(root, 'cat-file', '-e', `${revision}^{commit}`);
    return;
  } catch {}
  readRemote(root, 'fetch', '--no-tags', 'origin', ref);
  if (git(root, 'rev-parse', 'FETCH_HEAD^{commit}') !== revision)
    throw new Error('The staging head changed while fetching it');
}

/** Bind the Director's evidence to the exact captured staging revision. */
export function observeGoal(task: HostTask, signal: AbortSignal) {
  task.planningWorkspace(signal);
  const { source } = task.capture;
  const recentChanges = git(
    source.root,
    'log',
    '--first-parent',
    '--max-count=10',
    '--format=%h %s',
    source.revision,
  ).split('\n');
  return { revision: source.revision, recentChanges, source };
}
