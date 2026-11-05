import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { processStart } from '../operations/service-state.js';
import { HostConnection } from './host-connection.js';

/** Keeps a deployment alive without scheduling work and drains only its answering project hosts. */
export class ContainerLifetime {
  private readonly lease: ExecutionLease;

  private closing?: Promise<void>;

  /** Exclusively owns container lifetime; restart clears admission closure without resuming any run. */
  constructor(private readonly root: string) {
    this.lease = new ExecutionLease(join(root, 'container.lease.sqlite'));
    rmSync(join(root, 'container.closing'), { force: true });
  }

  /** Rejects new dispatch after deployment shutdown begins, including hosts still starting up. */
  static assertOpen(root: string): void {
    if (existsSync(join(root, 'container.closing')))
      throw new Error(
        'Container is shutting down; restart its lifetime service before new execution',
      );
  }

  /** Persists admission closure before discovery and shares one drain across repeated process signals. */
  shutdown(): Promise<void> {
    if (!this.closing) {
      writeFileSync(join(this.root, 'container.closing'), '', { mode: 0o600 });
      this.closing = this.drain();
    }
    return this.closing;
  }

  /** Signals verified live identities and waits without an execution deadline before releasing deployment ownership. */
  private async drain(): Promise<void> {
    try {
      const results = await Promise.allSettled(this.projects().map((key) => this.stop(key)));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length)
        throw new AggregateError(
          failed.map((result) => result.reason),
          'Project host drain failed',
        );
    } finally {
      this.lease.close();
    }
  }

  /** Reads only canonical private project keys; missing state does not create project execution. */
  private projects(): string[] {
    const directory = join(this.root, 'projects');
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[a-f0-9]{24}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  /** Uses an answering private endpoint rather than stale retained PID metadata before sending a signal. */
  private async stop(key: string): Promise<void> {
    const socket = join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`, key + '.sock');
    let identity;
    try {
      identity = await new HostConnection(socket).request({ action: 'identity' });
    } catch (error) {
      if (['ENOENT', 'ECONNREFUSED'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
      throw error;
    }
    const runtime = identity.runtime;
    if (
      identity.key !== key ||
      runtime?.root !== resolve(this.root) ||
      !Number.isSafeInteger(runtime.pid) ||
      runtime.pid <= 1 ||
      runtime.pid === process.pid ||
      typeof runtime.start !== 'string' ||
      !/^\d+$/.test(runtime.start)
    )
      throw new Error('Host lacks matching live deployment identity: ' + key);
    if (processStart(runtime.pid) !== runtime.start) return;
    try {
      process.kill(runtime.pid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    while (processStart(runtime.pid) === runtime.start) await delay(25);
  }
}
