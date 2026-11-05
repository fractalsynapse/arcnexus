import { stagingContext } from './staging-context.js';
import { developmentTarget } from './development-base.js';
import { githubDestination } from './run-destination.js';
import { ContainerLifetime } from './container-lifetime.js';
import { InputError } from '../architecture/config.js';
import { HostConnection, type HostRequest } from './host-connection.js';
import { randomUUID } from 'node:crypto';
import { git } from '../operations/process.js';
import { digest, resolveBase } from '../architecture/assignment.js';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HostRuntime } from './host-runtime.js';
import { setTimeout as delay } from 'node:timers/promises';
import {
  ExecutionContext,
  executionIdentity,
  type ProjectExecution,
} from '../architecture/execution-context.js';
import { stateRoot } from '../workspace/state.js';

export type { HostRequest } from './host-connection.js';

/** Connects CLI invocations to the one private host for a canonical repository. */
export class HostClient {
  private capturedContext?: ProjectExecution;

  private expectedEnvironmentId?: string;

  private readonly key: string;

  readonly directory: string;

  readonly socket: string;

  /** Resolves project identity without changing source or starting model execution. */
  constructor(
    private readonly cwd: string,
    readonly root = stateRoot(),
    private readonly target?: { packageId: string; base: string },
  ) {
    const { source } = resolveBase(cwd);
    const common = realpathSync(
      git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
    this.key = digest(common).slice(0, 24);
    this.directory = join(this.root, 'projects', this.key);
    const sockets = join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`);
    mkdirSync(sockets, { recursive: true, mode: 0o700 });
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.socket = join(sockets, this.key + '.sock');
  }

  /** Captures executable configuration only when creating or validating new work. */
  get context(): ProjectExecution {
    return (this.capturedContext ??= new ExecutionContext().resolve(
      this.cwd,
      this.target?.packageId,
      this.target?.base,
    ));
  }

  /** Selects live staging before admission; existing supervisors retain their own captured authority. */
  async ensureRun(action: 'submit' | 'start', simulate: boolean, signal: AbortSignal) {
    if (await this.retainedAdmission(action, simulate)) return;
    const discovered = this.context;
    const branch = developmentTarget(discovered);
    const repository = githubDestination(discovered);
    if (repository) {
      this.capturedContext = await stagingContext(
        discovered.source,
        discovered.packageId,
        this.directory,
        repository,
        branch,
        signal,
        false,
      );
    } else {
      this.capturedContext = new ExecutionContext().resolve(
        discovered.source,
        discovered.packageId,
        'refs/heads/' + branch,
      );
    }
    await this.ensure(action);
  }

  /** Keeps an existing isolated workday in its own upstream environment, including task admission. */
  private async retainedAdmission(action: string, simulate: boolean): Promise<boolean> {
    if (!(await this.alive())) return false;
    const { workday } = await this.request({ action: 'status' });
    if (!workday || workday.status === 'stopped') return false;
    if (action === 'start') return true;
    if (
      !simulate ||
      workday.environment?.mode !== 'simulation' ||
      !['running', 'idle', 'paused', 'pausing'].includes(workday.status)
    )
      return false;
    const identity = await this.request({ action: 'identity' });
    if (identity.packageId !== this.context.packageId) return false;
    if (!identity.hostCapabilities?.includes('staging-snapshot'))
      throw new InputError(
        'Retained simulation uses an older branch workflow; finish it before submitting new work',
      );
    this.expectedEnvironmentId = workday.environment.id;
    return true;
  }

  /** Starts a host when necessary and waits for its local readiness, not an execution deadline. */
  async ensure(action = 'status'): Promise<void> {
    if (!['status', 'stop', 'pause'].includes(action)) ContainerLifetime.assertOpen(this.root);
    if (await this.alive()) {
      if (await this.compatible(action)) return;
    }
    this.launch();
    await this.waitForHost();
    await this.compatible(action);
  }

  /** Refuses authority drift during retained work and replaces an inactive host automatically. */
  private async compatible(action: string): Promise<boolean> {
    if (['status', 'stop', 'pause'].includes(action)) return true;
    const context = (await this.request({ action: 'identity' })) as ProjectExecution;
    if (
      executionIdentity(context) === executionIdentity(this.context) &&
      (!this.context.observedStaging ||
        JSON.stringify(context.observedStaging) === JSON.stringify(this.context.observedStaging))
    )
      return true;
    const status = await this.request({ action: 'status' });
    if (
      (status.workday && status.workday.status !== 'stopped') ||
      status.tasks.some((r: { status: string }) => ['running', 'pausing'].includes(r.status))
    )
      throw new Error(
        'Captured source/package/bindings changed; stop the workday before starting with updated authority',
      );
    await this.request({ action: 'retire' });
    for (let observation = 0; observation < 100; observation++) {
      if (!(await this.alive())) return false;
      await delay(50);
    }
    throw new Error('Old host did not release execution ownership');
  }

  /** Starts the detached host with private context and logs, leaving execution to its scheduler. */
  private launch(): void {
    ContainerLifetime.assertOpen(this.root);
    const context = join(this.directory, 'context-' + randomUUID() + '.json');
    writeFileSync(context, JSON.stringify(this.context), { mode: 0o600 });
    new HostRuntime().launch(this.root, context, this.socket);
  }

  /** Sends a structured control through the shared private transport. */
  async request(request: HostRequest): Promise<any> {
    const connection = new HostConnection(this.socket);
    if (request.simulate === true) {
      const identity = await connection.request({ action: 'identity' });
      if (!identity.hostCapabilities?.includes('simulation'))
        throw new InputError(
          'Captured host does not support simulation; end retained runs and restart with the updated runtime',
        );
    }
    return connection.request(
      request.action === 'submit' && this.expectedEnvironmentId
        ? { ...request, expectedEnvironmentId: this.expectedEnvironmentId }
        : request,
    );
  }

  /** Confirms both process identity and an answering local endpoint before trusting a stale socket. */
  private async alive(): Promise<boolean> {
    if (!existsSync(this.socket)) return false;
    try {
      const identity = (await this.request({ action: 'identity' })) as ProjectExecution;
      return identity.key === this.key;
    } catch {
      return false;
    }
  }

  /** Bounds host startup observation only; no agent work is subject to this readiness window. */
  private async waitForHost(): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await this.alive()) return;
      await delay(50);
    }
    throw new Error('Execution host did not start; inspect ' + join(this.directory, 'host.log'));
  }
}
