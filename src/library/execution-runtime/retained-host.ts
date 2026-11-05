import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';
import { digest } from '../architecture/assignment.js';
import { git } from '../operations/process.js';
import { HostRuntime } from './host-runtime.js';
import { HostConnection } from './host-connection.js';

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

  /** Validates the protocol and captured authority before connecting or recovering an absent host. */
  async connect(identity: unknown, capability = 'task-control'): Promise<HostConnection> {
    const metadata = JSON.parse(readFileSync(join(this.directory, 'host.json'), 'utf8'));
    if (metadata.protocolVersion !== 2 || typeof metadata.contextFile !== 'string')
      throw new InputError(
        'Retained supervisor does not support task controls; evidence remains readable',
      );
    if (capability !== 'task-control' && !metadata.capabilities?.includes(capability))
      throw new InputError('Retained supervisor does not support ' + capability);
    if (basename(metadata.contextFile) !== metadata.contextFile)
      throw new InputError('Invalid retained context location');
    const contextPath = join(this.directory, metadata.contextFile);
    const context = JSON.parse(readFileSync(contextPath, 'utf8')) as ProjectExecution;
    if (context.key !== this.key || executionIdentity(context) !== identity)
      throw new InputError('Retained supervisor authority does not match this task');
    const connection = new HostConnection(this.socket);
    if (await this.alive(connection, identity)) return connection;
    this.launch(context, contextPath);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await this.alive(connection, identity)) return connection;
      await delay(50);
    }
    throw new Error('Retained host did not start; inspect ' + join(this.directory, 'host.log'));
  }

  /** Distinguishes an absent endpoint from an incompatible active host, which must never be replaced. */
  private async alive(connection: HostConnection, identity: unknown): Promise<boolean> {
    let context: ProjectExecution;
    try {
      context = await connection.request({ action: 'identity' });
    } catch (error) {
      if (['ENOENT', 'ECONNREFUSED'].includes((error as NodeJS.ErrnoException).code ?? ''))
        return false;
      throw error;
    }
    if (context.key !== this.key || executionIdentity(context) !== identity)
      throw new InputError('Another captured authority owns project execution');
    return true;
  }

  /** Restarts through the same installed launcher after validating repository identity. */
  private launch(context: ProjectExecution, contextPath: string): void {
    this.validate(context);
    mkdirSync(join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`), {
      recursive: true,
      mode: 0o700,
    });
    new HostRuntime().launch(this.root, contextPath, this.socket);
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
