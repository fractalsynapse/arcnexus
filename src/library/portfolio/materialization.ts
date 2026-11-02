import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { InputError } from '../architecture/config.js';
import { resolveBase } from '../architecture/assignment.js';
import { execute, git, type CommandResult } from '../operations/process.js';
import {
  PortfolioStore,
  type RepositoryMaterialization,
} from '../coordination-store/portfolio-store.js';

/** Materializes remote source through supervised Git and a durable, non-replaying intent journal. */
export class RepositoryMaterializer {
  /** Binds registry identity and evidence to the application volume, never to the caller's directory. */
  constructor(
    private readonly volume: string,
    private readonly store: PortfolioStore,
  ) {}

  /** Reserves a single clone per remote and refuses to replay any uncertain or failed invocation. */
  async prepare(input: string, signal: AbortSignal): Promise<RepositoryMaterialization> {
    signal.throwIfAborted();
    const remote = this.remote(input);
    const reservation = this.reserve(remote);
    const { entry, created } = reservation;
    if (!created) {
      if (entry.status === 'ready') return this.recover(entry);
      if (entry.status !== 'registered')
        throw new Error('Materialization requires reconciliation: ' + entry.id);
      return entry;
    }
    return this.clone(entry, signal);
  }

  /** Accepts only a recorded successful clone with matching retained identity, source and clean bytes. */
  private recover(entry: RepositoryMaterialization): RepositoryMaterialization {
    const path = join(this.volume, entry.evidence, 'result.json');
    try {
      const evidence = JSON.parse(readFileSync(path, 'utf8'));
      const current = resolveBase(join(this.volume, entry.location));
      if (
        evidence.operationId === 'portfolio.clone' &&
        evidence.repositoryId === entry.id &&
        evidence.remote === entry.remote &&
        evidence.result.exitCode === 0 &&
        current.base === entry.base &&
        !git(current.source, 'status', '--porcelain', '--untracked-files=all').trim() &&
        git(current.source, 'remote', 'get-url', 'origin').trim() === entry.remote
      )
        return entry;
    } catch {
      /* Missing or malformed evidence cannot establish a safe checkpoint. */
    }
    throw new Error('Materialized source or evidence requires reconciliation: ' + entry.id);
  }

  /** Atomically reserves a remote identity before filesystem or process side effects. */
  private reserve(remote: string) {
    return this.store.transaction('repository.materialization.requested', () => {
      const previous = this.store.materializations().find((item) => item.remote === remote);
      if (previous) return { entry: previous, created: false };
      const id = randomUUID();
      const root = join('repositories', id);
      const value: RepositoryMaterialization = {
        id,
        remote,
        location: join(root, 'source'),
        evidence: join(root, 'materialization'),
        status: 'pending',
      };
      this.store.materialization(value);
      return { entry: value, created: true };
    });
  }

  /** Validates transport input before persisting it, excluding credentials and executable Git transports. */
  private remote(input: string): string {
    let value: URL;
    try {
      value = new URL(input);
    } catch {
      throw new InputError('Expected an HTTPS or file repository URL');
    }
    if (
      !['https:', 'file:'].includes(value.protocol) ||
      value.username ||
      value.password ||
      value.search ||
      value.hash
    )
      throw new InputError('Unsupported repository transport or embedded credentials');
    if (value.protocol === 'file:' && value.hostname && value.hostname !== 'localhost')
      throw new InputError('File repository URLs must be local');
    return value.href;
  }

  /** Captures Git output and committed identity; all failures retain bytes and prohibit automatic replay. */
  private async clone(entry: RepositoryMaterialization, signal: AbortSignal) {
    const directory = join(this.volume, entry.evidence);
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const result = await this.invoke(entry, directory, signal);
      this.evidence(entry, directory, result);
      const { base } = resolveBase(join(this.volume, entry.location));
      const ready = { ...entry, status: 'ready' as const, base };
      this.store.transaction('repository.materialized', () => this.store.materialization(ready));
      return ready;
    } catch (error) {
      const result = (error as { commandResult?: CommandResult }).commandResult;
      if (result) this.evidence(entry, directory, result);
      this.fail(entry, error);
      throw error;
    }
  }

  /** Executes fixed clone arguments with parent-death cancellation and no ambient hooks or Git recipes. */
  private invoke(entry: RepositoryMaterialization, directory: string, signal: AbortSignal) {
    return execute(this.command(entry), this.volume, join(directory, 'clone.log'), signal, {
      processScope: true,
      env: {
        PATH: process.env.PATH,
        HOME: directory,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
        GIT_ALLOW_PROTOCOL: 'https:file',
      },
    });
  }

  /** Builds the only permitted Git mutation, confined to the reserved new repository destination. */
  private command(entry: RepositoryMaterialization) {
    return {
      command: 'git',
      args: [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'protocol.ext.allow=never',
        'clone',
        '--no-hardlinks',
        '--',
        entry.remote,
        join(this.volume, entry.location),
      ],
    };
  }

  /** Keeps the observed invocation as evidence; recovery never treats this file as executable instructions. */
  private evidence(
    entry: RepositoryMaterialization,
    directory: string,
    result: CommandResult,
  ): void {
    const value = {
      operationId: 'portfolio.clone',
      repositoryId: entry.id,
      remote: entry.remote,
      result,
    };
    writeFileSync(join(directory, 'result.json'), JSON.stringify(value, null, 2), { mode: 0o600 });
  }

  /** Retains failed validation or dispatch for explicit reconciliation instead of deleting partial source. */
  private fail(entry: RepositoryMaterialization, error: unknown): void {
    this.store.transaction('repository.materialization.failed', () =>
      this.store.materialization({
        ...entry,
        status: 'needs_attention',
        error: String(error),
      }),
    );
  }
}
