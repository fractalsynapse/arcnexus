import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';
import { digest } from '../architecture/assignment.js';
import { git } from '../operations/process.js';
import { HostRuntime } from './host-runtime.js';
import { HostConnection } from './host-connection.js';
import { HostReadiness } from './host-readiness.js';

/** Reconnects to captured run authority and restarts the installed runtime when its host is absent. */
export class RetainedHost {
  private readonly directory: string;

  private readonly socket: string;

  /** Resolves private runtime locations from a project key already found in authoritative storage. */
  constructor(
    private readonly root: string,
    private readonly key: string,
  ) {
    this.directory = join(root, 'projects', key);
    this.socket = join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`, key + '.sock');
  }

  /** Validates captured authority before connecting or recovering an absent host. */
  async connect(
    identity: unknown,
    capability = 'task-control',
    signal?: AbortSignal,
  ): Promise<HostConnection> {
    signal?.throwIfAborted();
    const retained = this.retainedContext(capability, identity);
    const connection = new HostConnection(this.socket);
    if (await this.active(connection, identity, signal)) return connection;
    signal?.throwIfAborted();
    const child = this.launch(retained.path);
    await new HostReadiness().wait(
      connection,
      this.key,
      child,
      join(this.directory, 'host.log'),
      identity,
      signal,
      join(retained.context.commonDir, 'arcnexus', 'host.lease.sqlite'),
    );
    return connection;
  }

  /** Loads retained authority only after checking protocol, capability and task identity. */
  private retainedContext(
    capability: string,
    identity: unknown,
  ): { path: string; context: ProjectExecution } {
    const metadata = JSON.parse(readFileSync(join(this.directory, 'host.json'), 'utf8'));
    if (metadata.protocolVersion !== 2 || typeof metadata.contextFile !== 'string')
      throw new InputError(
        'Retained supervisor does not support task controls; evidence remains readable',
      );
    if (capability !== 'task-control' && !metadata.capabilities?.includes(capability))
      throw new InputError('Retained supervisor does not support ' + capability);
    if (basename(metadata.contextFile) !== metadata.contextFile)
      throw new InputError('Invalid retained context location');
    const path = join(this.directory, metadata.contextFile);
    const context = JSON.parse(readFileSync(path, 'utf8')) as ProjectExecution;
    if (context.key !== this.key || executionIdentity(context) !== identity)
      throw new InputError('Retained supervisor authority does not match this task');
    this.validate(context);
    return { path, context };
  }

  /** Confirms an active endpoint or returns false while it cannot yet answer discovery. */
  private async active(
    connection: HostConnection,
    identity: unknown,
    signal?: AbortSignal,
  ): Promise<boolean> {
    try {
      const current = (await connection.request(
        { action: 'identity' },
        signal,
      )) as ProjectExecution;
      if (current.key !== this.key || executionIdentity(current) !== identity)
        throw new InputError('Another captured authority owns project execution');
      return true;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      const code = (error as NodeJS.ErrnoException).code;
      if (
        code === 'ENOENT' ||
        code === 'ECONNREFUSED' ||
        (error as Error).message === 'Host discovery transport timed out'
      )
        return false;
      throw error;
    }
  }

  /** Starts through the installed launcher after confirming the captured repository identity. */
  private launch(contextPath: string) {
    mkdirSync(join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`), {
      recursive: true,
      mode: 0o700,
    });
    return new HostRuntime().launch(this.root, contextPath, this.socket);
  }

  /** Refuses a different repository; fixed-mount recovery does not relocate or replace source. */
  private validate(context: ProjectExecution): void {
    const common = realpathSync(
      git(context.source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
    if (common !== context.commonDir || digest(common).slice(0, 24) !== this.key)
      throw new InputError(
        'Retained repository identity changed; reconcile registration before recovery',
      );
  }
}
