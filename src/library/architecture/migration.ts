import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { CandidateSnapshots } from '../workspace/candidates.js';
import { CheckedEdits } from '../workspace/checked-edits.js';
import { lock, stateRoot } from '../workspace/state.js';
import { git } from '../operations/process.js';
import { digest, resolveBase } from './assignment.js';
import { ancestry, covered, loadCatalog, type Catalog } from './components.js';
import { InputError } from './config.js';
import { captureMigrationAuthority, type MigrationAuthority } from './migration-authority.js';
import { MigrationDraft } from './migration-draft.js';
import { PlatformExecution } from './platform-execution.js';
import { standardPath } from './migration-standards.js';

interface Change {
  path: string;
  operation: 'create' | 'update' | 'delete';
  expectedSha256: string | null;
  content?: string;
}

/** Plans and applies validated migration candidates without staging, publishing or replacing active run authority. */
export class ConfigurationMigration {
  /** Captures only the caller's working directory; all executable inputs come from declared source authority. */
  constructor(private readonly cwd: string) {}

  /** Validates a private candidate and refuses stale selected revisions before applying a clean-checkout migration. */
  run(
    write = false,
    expectedBase?: string,
  ): { diff: string; changes: number; applied: boolean; evidence?: string } {
    try {
      const { source, base } = resolveBase(this.cwd);
      if (write) this.clean(source, base);
      const context = captureMigrationAuthority(this.cwd);
      if (expectedBase !== undefined && context.base !== expectedBase)
        throw new InputError('Source revision changed before configuration migration');
      const changes = this.changes(context, new MigrationDraft(context).create());
      if (!changes.length) return { diff: '', changes: 0, applied: false };
      return this.candidate(context, changes, write);
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError('Configuration migration blocked: ' + String(error));
    }
  }

  /** Requires unchanged source and index immediately before any caller-checkout write. */
  private clean(source: string, base: string): void {
    if (git(source, 'status', '--porcelain', '--untracked-files=all').trim())
      throw new InputError('Configuration migration --write requires a clean source checkout');
    if (git(source, 'rev-parse', 'HEAD').trim() !== base)
      throw new InputError('Source revision changed during configuration migration');
  }

  /** Produces exact before hashes and omits files whose serialized content is unchanged. */
  private changes(context: MigrationAuthority, draft: Map<string, unknown | null>): Change[] {
    const tracked = new Set(
      git(context.source, 'ls-tree', '-r', '--name-only', context.base).split('\n'),
    );
    const changes: Change[] = [];
    for (const [path, value] of draft) {
      const before = tracked.has(path)
        ? git(context.source, 'show', `${context.base}:${path}`)
        : null;
      const content =
        value === null
          ? null
          : path.endsWith('.json')
            ? JSON.stringify(value, null, 2) + '\n'
            : stringify(value);
      if (before === content) continue;
      changes.push({
        path,
        operation: before === null ? 'create' : content === null ? 'delete' : 'update',
        expectedSha256: before === null ? null : digest(before),
        ...(content === null ? {} : { content }),
      });
    }
    return changes;
  }

  /** Keeps candidate changes and checked-application journals outside editable source and retained run databases. */
  private candidate(context: MigrationAuthority, changes: Change[], write: boolean) {
    const project = join(stateRoot(), 'configuration-migrations', context.key);
    const directory = join(project, randomUUID());
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const unlock = lock(project);
    const workspace = join(directory, 'candidate');
    let registered = false;
    try {
      git(context.source, 'worktree', 'add', '--detach', workspace, context.base);
      registered = true;
      this.edit(workspace, join(directory, 'candidate-edits'), context.base, changes);
      const diff = this.validateCandidate(context, workspace, directory);
      if (write) {
        this.clean(context.source, context.base);
        this.edit(context.source, join(directory, 'source-edits'), context.base, changes);
      }
      return { diff, changes: changes.length, applied: write, evidence: directory };
    } finally {
      if (registered) git(context.source, 'worktree', 'remove', '--force', workspace);
      unlock();
    }
  }

  /** Validates the assembled candidate and captures the exact source diff before caller integration is possible. */
  private validateCandidate(
    context: MigrationAuthority,
    workspace: string,
    directory: string,
  ): string {
    const snapshots = new CandidateSnapshots(context.source, join(directory, 'snapshots'));
    const revision = snapshots.capture(workspace, context.base);
    const catalog = loadCatalog(context.source, revision, context.bindings);
    new PlatformExecution(catalog).defaults(context.source, revision);
    this.authority(context.catalog, catalog);
    return git(context.source, 'diff', '--no-ext-diff', '--no-textconv', context.base, revision);
  }

  /** Restricts the existing transactional edit service to the exact validated configuration change set. */
  private edit(workspace: string, directory: string, authority: string, changes: Change[]): void {
    const allowed = new Set(changes.map((change) => change.path));
    const edits = new CheckedEdits(workspace, directory, authority, (path) => {
      if (!allowed.has(path))
        throw new InputError('Migration edit outside validated changes: ' + path);
    });
    edits.apply({ id: 'configuration-migration', changes });
  }

  /** Refuses implicit ownership transfers, read expansions and lost inherited verification commands. */
  private authority(before: Catalog, after: Catalog): void {
    for (const old of Object.values(before.components)) {
      if (['platform', 'package'].includes(old.type)) continue;
      const next = after.components[old.id];
      if (
        !next ||
        JSON.stringify(old.allowedWritePaths.map(standardPath).sort()) !==
          JSON.stringify([...next.allowedWritePaths].sort())
      )
        throw new InputError('Migration changes exact ownership; resolve explicitly: ' + old.id);
      for (const key of ['role', 'executionProfile', 'testProfile'] as const)
        if (old[key] !== next[key])
          throw new InputError('Migration changes effective ' + key + ': ' + old.id);
      if (
        old.access.readPaths.some((path) => !covered(standardPath(path), next.access.readPaths)) ||
        next.access.readPaths.some(
          (path) =>
            !covered(path, [...old.access.readPaths, ...old.allowedWritePaths].map(standardPath)),
        )
      )
        throw new InputError('Migration changes effective reads: ' + old.id);
      this.verification(before, after, old.id);
    }
  }

  /** Checks inherited host command coverage independently of changed operation names and policy provenance. */
  private verification(before: Catalog, after: Catalog, id: string): void {
    const required = ancestry(before, id).flatMap((owner) => owner.verification);
    for (const check of required)
      if (
        !('command' in check) ||
        !after.components[id]!.verification.some(
          (operation) =>
            'command' in operation &&
            operation.command === check.command &&
            JSON.stringify(operation.args) === JSON.stringify(check.args),
        )
      )
        throw new InputError('Migration loses a captured verification command: ' + id);
  }
}
