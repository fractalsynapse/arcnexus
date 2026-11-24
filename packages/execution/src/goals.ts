import type { HostTask } from './index.js';
import type { Architecture, Capture } from '../../architecture/src/index.js';
import type { HostConfig } from './host-config.js';
import type { Coordination, Journal } from '../../coordination/src/index.js';
import { goalInventory } from '../../planner/src/inventory.js';
import type { CompletedGoalOutcome, GoalRound, TaskInput } from '../../workflow/src/index.js';
import { verifiedGoalRun } from './goal-evidence.js';
import { git, remoteRead } from './git.js';

/** Read goals from one reviewed staging revision and give this evaluation round a durable identity. */
export function goalRound(
  architecture: Architecture,
  coordination: Coordination,
  directory: string,
  namespace = 'task',
): GoalRound {
  const capture = stagingCapture(architecture, architecture.capture(directory));
  const remote = capture.source.remote;
  const { id, inventory } = coordination.round(
    remote,
    () => {
      const goals = goalInventory(capture);
      if (!goals.length) throw new Error('No standing goals in the captured project inventory');
      return JSON.stringify(goals);
    },
    namespace,
  );
  const goals = JSON.parse(inventory) as GoalRound['goals'];
  return {
    id,
    goals,
    completed: ({ body }, scope) => {
      const result = coordination.completedTask(remote, body, scope);
      if (result !== undefined) return JSON.parse(result) as CompletedGoalOutcome;
    },
    finish: () => coordination.completeRound(remote, id),
  };
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
    '--format=%h %s',
    source.revision,
  ).split('\n');
  const measures = task.goal
    .split(/(?:\*\*Success measures\.\*\*|^#{1,6} Success measures)/im)
    .at(-1);
  const requiresRun = /\b(?:pass(?:es|ing)?|runs?|real delivery|live|exit status)\b/i.test(
    measures ?? '',
  );
  return {
    revision: source.revision,
    recentChanges,
    source,
    run: verifiedGoalRun(task),
    requiresRun,
  };
}

/** Refresh a pending planning admission before any issue branch has been prepared. */
export function recordAdmission(
  journal: Journal,
  config: HostConfig,
  planning?: TaskInput['planning'],
) {
  if (!config.fresh) return;
  const revision = config.capture.source.revision;
  if (!journal.retained) {
    journal.record({
      baseRevision: revision,
      ...(planning && { planningExecution: { revision } }),
    });
    return;
  }
  if (!planning) return;
  const events = journal.retained.events as {
    baseRevision?: string;
    workspace?: number;
    publication?: unknown;
  }[];
  const previous = events.findLast((event) => event.baseRevision)?.baseRevision;
  if (previous === revision || events.some((event) => event.workspace || event.publication)) return;
  journal.record({
    baseRevision: revision,
    plannerRefresh: revision,
    planningExecution: { revision },
  });
}
