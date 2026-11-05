import { developmentTarget } from './development-base.js';
import { githubDestination } from './run-destination.js';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { RepositoryMaterialization } from '../architecture/bindings.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { Environment } from '../architecture/config.js';
import { execute, git } from '../operations/process.js';

/** Materializes captured repository objects and local remotes without retaining upstream destinations. */
export class SimulationRepositories {
  /** Binds all copies to the host's immutable catalog and private environment directory. */
  constructor(
    private readonly context: ProjectExecution,
    private readonly directory: string,
  ) {}

  /** Copies every captured repository, including dependencies, before returning a publishable mapping. */
  async prepare(signal: AbortSignal): Promise<Record<string, RepositoryMaterialization>> {
    const result: Record<string, RepositoryMaterialization> = {};
    const environment = this.context.catalog.configurationSources.find((entry) =>
      /^architecture\/environment\.(yaml|yml|json)$/.test(entry.path),
    )?.value as Environment;
    for (const [id, revision] of Object.entries(this.context.catalog.repositoryRevisions ?? {})) {
      const repository =
        id === this.context.catalog.primaryRepository
          ? environment.workspace?.primary.repository
          : environment.workspace?.dependencies.find((entry) => entry.id === id)?.repository;
      result[id] = await this.copy(id, revision.source, revision.base, repository, signal);
    }
    return result;
  }

  /** Uses independent object stores and retains failed clone output without overwriting uncertain work. */
  private async copy(
    id: string,
    source: string,
    base: string,
    repository: string | undefined,
    signal: AbortSignal,
  ): Promise<RepositoryMaterialization> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Unsafe captured repository identity');
    const directory = join(this.directory, id);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const origin = join(directory, 'remote.git');
    const destination = join(directory, 'source');
    if (id === this.context.catalog.primaryRepository)
      await this.seedPrimary(source, origin, base, directory, signal);
    else await this.copyDependency(source, origin, directory, signal);
    await this.materialize(destination, origin, base, directory, signal);
    return {
      source: realpathSync(destination),
      base,
      repository,
      origin,
      commonDir: realpathSync(git(destination, 'rev-parse', '--absolute-git-dir').trim()),
    };
  }

  /** Copies dependency refs without retaining the source repository as an upstream destination. */
  private async copyDependency(
    source: string,
    origin: string,
    directory: string,
    signal: AbortSignal,
  ) {
    await this.command(
      ['clone', '--bare', '--no-local', '--', source, origin],
      source,
      directory,
      'remote',
      signal,
    );
    git(origin, 'remote', 'remove', 'origin');
  }

  /** Seeds only the observed integration branch in a new isolated bare repository. */
  private async seedPrimary(
    source: string,
    origin: string,
    base: string,
    directory: string,
    signal: AbortSignal,
  ) {
    const branch = developmentTarget(this.context);
    const ref = 'refs/heads/' + branch;
    git(source, 'check-ref-format', ref);
    this.validateSnapshot(source, branch, ref, base);
    await this.command(
      ['init', '--bare', '--initial-branch=' + branch, origin],
      source,
      directory,
      'remote',
      signal,
    );
    await this.command(
      ['fetch', '--no-tags', '--', source, base + ':' + ref],
      origin,
      directory,
      'seed',
      signal,
    );
    if (git(origin, 'show-ref', '--verify', '--hash', ref).trim() !== base)
      throw new Error('Simulation staging differs from the observed source');
  }

  /** Refuses an unobserved GitHub ref or a local staging ref that moved after admission. */
  private validateSnapshot(source: string, branch: string, ref: string, base: string): void {
    const upstream = githubDestination(this.context);
    if (upstream) {
      const observed = this.context.observedStaging;
      if (
        observed?.repository !== upstream ||
        observed.branch !== branch ||
        this.context.base !== base
      )
        throw new Error('Simulation requires an observed GitHub staging snapshot before setup');
    } else if (git(source, 'show-ref', '--verify', '--hash', ref).trim() !== base)
      throw new Error('Local staging changed before simulation setup');
  }

  /** Creates independent source and remote stores before checking out the captured revision. */
  private async materialize(
    destination: string,
    origin: string,
    base: string,
    directory: string,
    signal: AbortSignal,
  ): Promise<void> {
    await this.command(
      ['clone', '--no-local', '--no-checkout', '--', origin, destination],
      directory,
      directory,
      'clone',
      signal,
    );
    await this.command(['checkout', '--detach', base], destination, directory, 'checkout', signal);
  }

  /** Supervises fixed host Git operations with file-only transport and no personal credentials or hooks. */
  private async command(
    args: string[],
    cwd: string,
    directory: string,
    name: string,
    signal: AbortSignal,
  ): Promise<void> {
    const log = join(directory, name + '.log');
    const result = await execute(
      { command: 'git', args: ['-c', 'core.hooksPath=/dev/null', ...args] },
      cwd,
      log,
      signal,
      {
        processScope: true,
        env: {
          PATH: process.env.PATH,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
          GIT_ALLOW_PROTOCOL: 'file',
        },
      },
    );
    if (result.exitCode !== 0) throw new Error('Simulation Git operation failed; inspect ' + log);
  }
}
