import { parse } from 'yaml';
import type { Architecture, Capture } from '../../architecture/src/index.js';
import type { Coordination } from '../../coordination/src/index.js';
import { team } from '../../team/src/index.js';
import type { GoalRound, StandingGoal } from '../../workflow/src/index.js';
import { git, remoteRead } from './git.js';

/** Read goals from one reviewed staging revision and give this evaluation round a durable identity. */
export function goalRound(
  architecture: Architecture,
  coordination: Coordination,
  directory: string,
): GoalRound {
  const local = architecture.capture(directory);
  const capture = stagingCapture(architecture, local);
  const goals = inventory(capture);
  const remote = capture.source.remote;
  const id = coordination.round(remote, JSON.stringify(goals));
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
    inventory(capture);
    throw new Error('Standing goals need a staging delivery branch');
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

/** Read Markdown goals once and order equal priorities by their stable file IDs. */
function inventory(capture: Capture) {
  const prefix = `${capture.project.knowledgeRoot ?? '.arc'}/goals/`;
  const goals = capture.source.paths
    .filter((path) => path.startsWith(prefix) && path.endsWith('.md'))
    .map((path) => definition(capture, path, path.slice(prefix.length, -3)));
  if (!goals.length) throw new Error('No standing goals in the captured project inventory');
  return goals.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/** Validate the identity, priority, accountable owner and executable measure of one goal. */
function definition(capture: Capture, path: string, id: string): StandingGoal {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(capture.source.read(path));
  if (!match || !/^[a-z0-9][a-z0-9-]*$/.test(id))
    throw new Error(`Invalid standing goal document: ${path}`);
  const [, metadata, body] = match;
  const fields = parse(metadata!) as { priority?: number; owner?: string } | null;
  if (!Number.isSafeInteger(fields?.priority) || typeof fields?.owner !== 'string' || !body?.trim())
    throw new Error(`Standing goal requires a numeric priority, owner and goal text: ${path}`);
  const member = team.list(capture.components, { component: fields.owner, activity: 'testing' })[0];
  if (!member?.activities.testing?.operations.includes('owner-tests'))
    throw new Error(`Standing goal owner has no declared owner-tests measure: ${path}`);
  return { id, priority: fields.priority!, owner: fields.owner, body };
}
