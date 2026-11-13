import { ExecutionContext } from '../architecture/execution-context.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { saveMarkdown } from '../report/report.js';
import { WorkspaceResources, type WorkspaceTarget } from './resources.js';
import { WorkspaceOperations } from './operation-preparation.js';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { captureWorktreeBindings, loadBindings, type Bindings } from '../architecture/bindings.js';
import { environment, InputError, type Environment } from '../architecture/config.js';
import { ConfigurationReader } from '../architecture/configuration.js';
import { git } from '../operations/process.js';
import { observe } from '../report/timeline.js';
import { WorkspaceCleanup } from './cleanup.js';
import {
  assertMembers,
  freezeMembers,
  prepareMembers,
  resolveMembers,
  type Member,
} from './members.js';
import { assertOutputs } from './outputs.js';
import { save, statePath, stateRoot, type RecordData } from './state.js';

export { assertGeneratedOutputs, assertOutputs } from './outputs.js';

export { EvidenceRetention } from './evidence-retention.js';

export { WorkspaceReclamation } from './reclamation.js';

export { WorkspaceResources, type WorkspaceTarget } from './resources.js';

export interface PrepareOptions {
  project: string;
  base?: string;
  authorityBase?: string;
  branchBase?: string;
  packageId?: string;
  issue?: string;
  bindings?: Bindings;
}

export function assertIdentity(record: RecordData): void {
  if (git(record.workspace, 'rev-parse', 'HEAD').trim() !== record.base || !matchesBranch(record))
    throw new Error('Candidate branch or HEAD changed');
  if ((record.members as Member[] | undefined)?.length) assertMembers(record);
}

/** Recognizes a completed delivery's archived worktree only while its journaled branch head is intact. */
function matchesBranch(record: RecordData): boolean {
  const branch = git(record.workspace, 'branch', '--show-current').trim();
  if (branch === record.branch) return true;
  if (branch || record.status !== 'completed' || typeof record.developmentHead !== 'string')
    return false;
  return (
    git(record.source, 'rev-parse', 'refs/heads/' + record.branch).trim() ===
      record.developmentHead &&
    git(record.source, 'show', '-s', '--format=%P', record.developmentHead).trim() === record.base
  );
}

export function createWorkspace(root: string, options: PrepareOptions): RecordData {
  const { source, base, env, commonDir } = inspectSource(options);
  const id = randomUUID(),
    branch = `codex/${options.issue ?? 'run'}-${id}`;
  const record: RecordData = {
    id,
    source,
    base,
    commonDir,
    branch,
    ...(options.branchBase ? { branchBase: options.branchBase } : {}),
    workspace: join(root, 'workspaces', id),
    status: 'preparing',
    startedAt: new Date().toISOString(),
    environment: env,
    commands: [],
  };
  record.bindings = options.bindings ?? loadBindings();
  captureConfiguration(record, options);
  WorkspaceOperations.capture(
    record,
    options.project,
    options.authorityBase ?? record.base,
    options.packageId,
  );
  mkdirSync(join(root, 'runs', id), { mode: 0o700 });
  save(root, record);
  observe(root, record, 'run.created', { base, branch, workspace: record.workspace });
  return record;
}

/** Captures workspace setup authority separately from the accumulated candidate revision. */
function captureConfiguration(record: RecordData, options: PrepareOptions): void {
  record.configurationSources = [
    new ConfigurationReader().definition(
      record.source,
      options.authorityBase ?? record.base,
      '.arc/architecture/environment',
    ),
    ...(options.bindings?.configurationSource ? [options.bindings.configurationSource] : []),
  ];
  record.members = resolveMembers(
    record.source,
    options.authorityBase ?? record.base,
    record.workspace,
    record.environment,
    record.bindings as Bindings,
  );
}

/**
 * Resolves the operator's own checkout as authority, without the candidate clean-tree rule.
 *
 * In-place work may proceed over uncommitted files that do not intersect the addressed component's
 * scope, and that decision belongs to the stance guard at run creation. Requiring a clean tree here
 * would duplicate a rule from a different job and refuse work the ruling allows.
 */
function inPlaceAuthority(options: PrepareOptions) {
  const source = realpathSync(git(resolve(options.project), 'rev-parse', '--show-toplevel').trim());
  const base = git(source, 'rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}').trim();
  const commonDir = git(source, 'rev-parse', '--git-common-dir').trim();
  const env = environment(
    new ConfigurationReader().definition(
      source,
      options.authorityBase ?? base,
      '.arc/architecture/environment',
    ).value,
  );
  assertNoSubmodules(source, base);
  // A detached HEAD is refused rather than guessed at: "current branch" has no meaning there, and
  // inventing one would put the operator's edits on a branch they never chose.
  const branch = git(source, 'branch', '--show-current').trim();
  if (!branch)
    throw new InputError(
      'In-place work requires a checked-out branch; the current checkout is detached',
    );
  return { source, base, commonDir, env, branch };
}

/**
 * Records the operator's own checkout as the workspace: no worktree, no branch creation.
 *
 * In-place work deliberately updates the current project, so the workspace record is the same shape
 * every writer already keys on (`record.workspace`) but pointed at the checkout instead of a
 * directory made under the state root. Authority capture runs unchanged, so component ownership and
 * checked-edit refusal apply to these writes exactly as they do to a candidate.
 */
export function inPlaceWorkspace(root: string, options: PrepareOptions): RecordData {
  const { source, base, env, commonDir, branch } = inPlaceAuthority(options);
  const id = randomUUID();
  const record: RecordData = {
    id,
    source,
    base,
    commonDir,
    branch,
    workspace: source,
    inPlace: true,
    status: 'ready',
    startedAt: new Date().toISOString(),
    environment: env,
    commands: [],
  };
  return bindInPlaceWorkspace(root, record, options);
}

/**
 * Binds an in-place record to the machine and captures its operation authority.
 *
 * The per-run state directory is created here because the candidate path makes it inside
 * createWorkspace, and attempt artifacts, transcripts and the report all write into it. Operation
 * execution reads the materialization binding to decide what an operation may reach, so an in-place
 * run needs the same capture, bound to the operator's checkout rather than a generated worktree.
 */
function bindInPlaceWorkspace(
  root: string,
  record: RecordData,
  options: PrepareOptions,
): RecordData {
  mkdirSync(join(root, 'runs', record.id as string), { mode: 0o700 });
  record.bindings = options.bindings ?? loadBindings();
  captureConfiguration(record, options);
  record.materializationBinding = captureWorktreeBindings(
    record.workspace,
    record.bindings as Bindings,
  );
  WorkspaceOperations.capture(
    record,
    options.project,
    options.authorityBase ?? (record.base as string),
    options.packageId,
  );
  return record;
}

export async function prepareWorkspace(
  root: string,
  record: RecordData,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  // In-place work has nothing to prepare: the source is the operator's checkout and the branch is
  // theirs already, so building a worktree is both forbidden and refused by git. All preparation
  // callers pass through here, which is why one guard prevents a second workspace path from existing.
  if (record.inPlace === true) return;
  if (record.environment.schemaVersion < 4)
    throw new InputError('Preparation requires a captured environment of schema 4 or later');
  prepareBranch(record);
  record.materializationBinding = captureWorktreeBindings(
    record.workspace,
    record.bindings as Bindings,
  );
  save(root, record);
  observe(root, record, 'workspace.created', { workspace: record.workspace, base: record.base });
  const shared = new WorkspaceOperations(root, record, signal);
  await prepareMembers(root, record, signal, (member) => shared.member(member));
  observe(root, record, 'workspace.members', { members: record.members });
  await shared.primary();
  freezeMembers(root, record);
  assertIdentity(record);
  assertOutputs(record.workspace, record.environment);
  record.status = 'prepared';
  observe(root, record, 'workspace.prepared', { members: record.members });
  save(root, record);
}

/** Cuts the private branch at observed staging, then includes only a verified descendant baseline. */
function prepareBranch(record: RecordData): void {
  const start = record.branchBase ?? record.base;
  if (git(record.source, 'rev-list', '--max-count=1', start, '--not', record.base).trim())
    throw new Error('Candidate is missing commits from the development branch base');
  git(record.source, 'worktree', 'add', '-b', record.branch, record.workspace, start);
  if (start !== record.base)
    git(record.workspace, '-c', 'core.hooksPath=/dev/null', 'merge', '--ff-only', record.base);
}

/** Moves an assignment's existing branch to its verified successor worktree and retains the old checkout. */
export function continueDevelopmentBranch(previous: RecordData, next: RecordData): void {
  if (
    !previous.assignmentId ||
    next.assignmentId !== previous.assignmentId ||
    !previous.executionRunId ||
    previous.executionRunId !== next.executionRunId ||
    previous.commonDir !== next.commonDir ||
    previous.workspace === next.workspace ||
    previous.branch === next.branch ||
    previous.branch !== 'codex/run-' + previous.id ||
    next.branch !== 'codex/run-' + next.id
  )
    throw new Error(
      'Development branch continuation requires distinct worktrees of the same assignment',
    );
  assertIdentity(previous);
  assertIdentity(next);
  const ref = 'refs/heads/' + previous.branch;
  const prior = git(next.source, 'rev-parse', ref).trim();
  if (git(next.source, 'rev-list', '--max-count=1', prior, '--not', next.base).trim())
    throw new Error('Development continuation would lose retained commits');
  git(previous.workspace, '-c', 'core.hooksPath=/dev/null', 'switch', '--detach', previous.base);
  git(next.source, 'update-ref', '--no-deref', ref, next.base, prior);
  git(next.workspace, '-c', 'core.hooksPath=/dev/null', 'switch', '--no-guess', previous.branch);
  next.branch = previous.branch;
  assertIdentity(next);
}

export function cleanup(root: string, id: string): RecordData {
  return new WorkspaceCleanup(root, id).run();
}

function inspectSource(options: PrepareOptions) {
  let source: string, base: string, env: Environment, commonDir: string;
  try {
    source = realpathSync(git(resolve(options.project), 'rev-parse', '--show-toplevel').trim());
    if (git(source, 'status', '--porcelain', '--untracked-files=all').trim())
      throw new Error('Source checkout must be clean');
    base = git(
      source,
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${options.base ?? 'HEAD'}^{commit}`,
    ).trim();
    env = environment(
      new ConfigurationReader().definition(
        source,
        options.authorityBase ?? base,
        '.arc/architecture/environment',
      ).value,
    );
    assertNoSubmodules(source, base);
    commonDir = realpathSync(
      git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
  } catch (error) {
    throw new InputError(String(error));
  }
  return { source, base, env, commonDir };
}

function assertNoSubmodules(source: string, base: string): void {
  if (
    git(source, 'ls-tree', '-r', base)
      .split('\n')
      .some((line) => line.startsWith('160000 '))
  )
    throw new Error('Submodules are unsupported');
}

export interface WorkspacePreparationTarget {
  source: string;
  base: string;
  packageId: string;
}

/** Prepares captured packages through the existing executor under exclusive repository ownership. */
export class WorkspacePreparation {
  /** Retains an optional application state root without creating files before preflight. */
  constructor(private readonly root?: string) {}

  /** Captures authority and acquires the host's canonical lease before creating a worktree. */
  async prepare(target: WorkspacePreparationTarget, signal: AbortSignal) {
    signal.throwIfAborted();
    if (!target.source?.trim() || !target.base?.trim() || !target.packageId?.trim())
      throw new InputError('Captured source, revision and package identity are required');
    const context = new ExecutionContext().resolve(target.source, target.packageId, target.base);
    const lease = new ExecutionLease(join(context.commonDir, 'arcnexus', 'host.lease.sqlite'));
    try {
      const location = this.root ?? stateRoot();
      for (const name of ['runs', 'workspaces'])
        mkdirSync(join(location, name), { recursive: true, mode: 0o700 });
      const root = realpathSync(location);
      const record = createWorkspace(root, {
        project: context.source,
        base: context.base,
        packageId: context.packageId,
        bindings: context.bindings,
      });
      record.packageId = context.packageId;
      save(root, record);
      await this.execute(root, record, signal);
      return new WorkspaceResources(root).get(record.id);
    } finally {
      lease.close();
    }
  }

  /** Preserves terminal failure/cancellation evidence without removing or replaying partial preparation. */
  private async execute(root: string, record: RecordData, signal: AbortSignal): Promise<void> {
    try {
      await prepareWorkspace(root, record, signal);
    } catch (error) {
      record.status = signal.aborted ? 'cancelled' : 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
    record.outcome = record.status;
    record.finishedAt = new Date().toISOString();
    record.elapsedMs = Date.now() - Date.parse(record.startedAt);
    observe(root, record, 'run.finalized', { status: record.status, outcome: record.outcome });
    save(root, record);
    saveMarkdown(root, record);
  }
}

/** Selects package-owned resources and serializes disposal through the existing cleanup engine. */
export class WorkspaceDisposal {
  private readonly root: string;

  /** Canonicalizes existing state without creating storage during service construction. */
  constructor(root = statePath()) {
    this.root = existsSync(root) ? realpathSync(root) : resolve(root);
  }

  /** Checks captured membership and revision before removing anything under canonical repository ownership. */
  cleanup(
    target: WorkspaceTarget,
    input: { workspace?: string; expectedRevision?: string },
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    if (!target.source?.trim() || !target.packageId?.trim())
      throw new InputError('Source and package identity are required');
    const common = realpathSync(
      git(target.source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
    const lease = new ExecutionLease(join(common, 'arcnexus', 'host.lease.sqlite'));
    try {
      const selected = this.selection(target, input.workspace);
      if (input.expectedRevision !== undefined && input.expectedRevision !== selected.revision)
        throw new Error('Workspace revision changed; read the resource again');
      const items = selected.items.map((item) => this.remove(item, signal));
      return {
        status: items.some((item) => !['removed', 'dependencies_reclaimed'].includes(item.status))
          ? 'partial'
          : 'completed',
        items,
      };
    } finally {
      lease.close();
    }
  }

  /** Captures all pages before mutation, rejecting identities outside the selected package. */
  private selection(target: WorkspaceTarget, id?: string) {
    const resources = new WorkspaceResources(this.root);
    if (id !== undefined) {
      const result = resources.get(id);
      if (
        result.workspace.source !== target.source ||
        result.workspace.packageId !== target.packageId
      )
        throw new InputError('Workspace does not belong to the selected package');
      return { revision: result.revision, items: [result.workspace] };
    }
    const first = resources.list(target),
      items = [...first.items];
    let cursor = first.nextCursor;
    while (cursor) {
      const page = resources.list(target, { cursor });
      items.push(...page.items);
      cursor = page.nextCursor;
    }
    return { revision: first.revision, items };
  }

  /** Preserves unfinished resources and reports cleanup refusals without abandoning unrelated work. */
  private remove(item: ReturnType<WorkspaceResources['get']>['workspace'], signal: AbortSignal) {
    signal.throwIfAborted();
    try {
      if (
        !item.finishedAt &&
        !['removed', 'completed'].includes(item.status) &&
        !(item.retained && item.status === 'prepared')
      )
        throw new Error('Workspace is unfinished; inspect before cleanup');
      const result = cleanup(this.root, item.id);
      return {
        id: item.id,
        status: String(result.cleanupStatus),
        revision: new WorkspaceResources(this.root).get(item.id).revision,
      };
    } catch (error) {
      return {
        id: item.id,
        status:
          !existsSync(item.location) ||
          new WorkspaceResources(this.root).get(item.id).workspace.dependencyCleanup?.status ===
            'removing' ||
          existsSync(join(this.root, 'runs', item.id, 'cleanup-intent.json'))
            ? 'needs_attention'
            : 'preserved',
        error: String(error),
        revision: item.revision,
      };
    }
  }
}
