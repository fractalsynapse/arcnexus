import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import type { ChildProcess } from 'node:child_process';
import { InputError } from '../architecture/config.js';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { HostConnection } from './host-connection.js';

type StartupState = { failure?: Error };

/** Observes endpoint readiness while retaining evidence from the one launched host. */
export class HostReadiness {
  /** Waits for identity readiness or reports cancellation and observed process failure. */
  async wait(
    connection: HostConnection,
    key: string,
    child: ChildProcess | undefined,
    log: string,
    expectedIdentity?: unknown,
    signal?: AbortSignal,
    leasePath?: string,
  ): Promise<ProjectExecution> {
    const state: StartupState = {};
    const unwatch = this.watch(child, state);
    try {
      return await this.observe(connection, key, log, state, expectedIdentity, signal, leasePath);
    } finally {
      unwatch();
    }
  }

  /** Retains process failure for diagnosis without using shared log text to infer ownership. */
  private watch(child: ChildProcess | undefined, state: StartupState): () => void {
    const onError = (error: Error) => (state.failure = error);
    const onClose = (code: number | null, signalName: NodeJS.Signals | null) => {
      state.failure = new Error('process exited with code ' + code + ' and signal ' + signalName);
    };
    child?.once('error', onError);
    child?.once('close', onClose);
    return () => {
      child?.removeListener('error', onError);
      child?.removeListener('close', onClose);
    };
  }

  /** Waits for readiness and consults canonical ownership before treating child exit as failure. */
  private async observe(
    connection: HostConnection,
    key: string,
    log: string,
    state: StartupState,
    expectedIdentity?: unknown,
    signal?: AbortSignal,
    leasePath?: string,
  ): Promise<ProjectExecution> {
    while (true) {
      signal?.throwIfAborted();
      const identity = await this.cancellableProbe(connection, key, expectedIdentity, signal);
      if (identity) return identity;
      if (state.failure && !(leasePath && this.ownerActive(leasePath)))
        throw this.startupError(state.failure, log);
      await delay(50, undefined, { signal });
    }
  }

  /** Checks the authoritative SQLite lease held by the canonical repository host. */
  private ownerActive(path: string): boolean {
    try {
      new ExecutionLease(path).close();
      return false;
    } catch (error) {
      if ((error as Error).message === 'A host already owns project execution') return true;
      throw error;
    }
  }

  /** Races endpoint observation against cancellation while preserving socket cancellation. */
  private cancellableProbe(
    connection: HostConnection,
    key: string,
    expected: unknown,
    signal?: AbortSignal,
  ): Promise<ProjectExecution | undefined> {
    if (!signal) return this.probe(connection, key, expected);
    signal.throwIfAborted();
    let abort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    });
    return Promise.race([this.probe(connection, key, expected, signal), aborted]).finally(() =>
      signal.removeEventListener('abort', abort),
    );
  }

  /** Returns identity when ready and treats only an unavailable endpoint as initialization. */
  private async probe(
    connection: HostConnection,
    key: string,
    expected?: unknown,
    signal?: AbortSignal,
  ): Promise<ProjectExecution | undefined> {
    try {
      const identity = (await connection.request(
        { action: 'identity' },
        signal,
      )) as ProjectExecution;
      this.assertIdentity(identity, key, expected);
      return identity;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error instanceof InputError || !this.endpointAbsent(error)) throw error;
      return undefined;
    }
  }

  /** Rejects foreign or incompatible authority instead of treating it as startup absence. */
  private assertIdentity(identity: ProjectExecution, key: string, expected?: unknown): void {
    if (identity.key !== key) throw new InputError('Another host owns project execution');
    if (expected !== undefined && executionIdentity(identity) !== expected)
      throw new InputError('Another captured authority owns project execution');
  }

  /** Classifies a missing or initializing endpoint without imposing a startup deadline. */
  private endpointAbsent(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return (
      code === 'ENOENT' ||
      code === 'ECONNREFUSED' ||
      (error as Error).message === 'Host discovery transport timed out'
    );
  }

  /** Reports process failure with retained startup output for diagnosis. */
  private startupError(failure: Error, log: string): Error {
    const output = this.startupOutput(log);
    return new Error(
      'Execution host startup failed (' + failure.message + '); inspect ' + log + '\n' + output,
    );
  }

  /** Reads only the retained tail needed to diagnose startup. */
  private startupOutput(log: string): string {
    try {
      return readFileSync(log, 'utf8').slice(-4000).trim();
    } catch {
      return 'Startup log is unavailable.';
    }
  }
}
