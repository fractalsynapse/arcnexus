import { ExecutionContext } from '../architecture/execution-context.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { saveMarkdown } from '../report/report.js';
import { WorkspaceResources } from './resources.js';
import { WorkspaceOperations } from './operation-preparation.js';
import { randomUUID } from 'node:crypto';
import { mkdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadBindings, type Bindings } from '../architecture/bindings.js';
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
import { save, stateRoot, type RecordData } from './state.js';

export { assertGeneratedOutputs, assertOutputs } from './outputs.js';

export { WorkspaceResources, type WorkspaceTarget } from './resources.js';

export interface PrepareOptions {
  project: string;
  base?: string;
  authorityBase?: string;
  packageId?: string;
  issue?: string;
  bindings?: Bindings;
}

export function assertIdentity(record: RecordData): void {
  if (
    git(record.workspace, 'rev-parse', 'HEAD').trim() !== record.base ||
    git(record.workspace, 'branch', '--show-current').trim() !== record.branch
  )
    throw new Error('Candidate branch or HEAD changed');
  if ((record.members as Member[] | undefined)?.length) assertMembers(record);
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
      'architecture/environment',
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

export async function prepareWorkspace(
  root: string,
  record: RecordData,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (record.environment.schemaVersion < 4)
    throw new InputError(
      'Preparation requires environment schema 4 or 5; migrate legacy recipes before execution',
    );
  git(record.source, 'worktree', 'add', '-b', record.branch, record.workspace, record.base);
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
        'architecture/environment',
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
