import { ContainerLifetime } from './container-lifetime.js';
import { InputError } from '../architecture/config.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { createServer, type Socket } from 'node:net';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { HostRuntime } from './host-runtime.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import { processStart } from '../operations/service-state.js';
import { ProjectHost } from './project-host.js';
import type { HostRequest } from './host-client.js';
import { WorkspaceReclamation } from '../workspace/workspace.js';

const hostCapabilities = [
  'task-control',
  'workday-control',
  'simulation',
  'delivery-control',
  'delivery-promote',
  'staging-snapshot',
];

/** Owns the private IPC listener and keeps lifecycle controls responsive during inference. */
class HostServer {
  private readonly host: ProjectHost;

  private readonly lease: ExecutionLease;

  private retiring = false;

  private timer?: ReturnType<typeof setInterval>;

  private readonly server = createServer((socket) => this.connection(socket));

  /** Opens the sole project writer using the captured startup context. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly socket: string,
    private readonly contextFile: string,
  ) {
    ContainerLifetime.assertOpen(this.root);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.lease = new ExecutionLease(join(context.commonDir, 'arcnexus', 'host.lease.sqlite'));
    new WorkspaceReclamation(this.root).reclaim();
    this.host = new ProjectHost(root, context);
  }

  /** Publishes readiness after binding IPC and starts sequential scheduling. */
  start(): void {
    ContainerLifetime.assertOpen(this.root);
    rmSync(this.socket, { force: true });
    this.server.listen(this.socket, () => this.ready());
    for (const signal of ['SIGTERM', 'SIGINT'] as const)
      process.on(signal, () => void this.shutdown());
    this.timer = setInterval(() => {
      try {
        ContainerLifetime.assertOpen(this.root);
      } catch {
        return;
      }
      if (!this.retiring) void this.host.tick().catch((error) => console.error(error));
    }, 100);
  }

  /** Publishes process and captured-runtime identity only after IPC accepts connections. */
  private ready(): void {
    chmodSync(this.socket, 0o600);
    const runner = new HostRuntime().record(
      this.host.store,
      join(this.root, 'projects', this.context.key),
    );
    writeFileSync(
      join(this.root, 'projects', this.context.key, 'host.json'),
      JSON.stringify({
        protocolVersion: 2,
        capabilities: hostCapabilities,
        contextFile: basename(this.contextFile),
        pid: process.pid,
        start: processStart(process.pid),
        runner,
      }),
      { mode: 0o600 },
    );
  }

  /** Closes admission and retains interruption after managed subprocesses drain on container or terminal shutdown. */
  private async shutdown(): Promise<void> {
    if (this.retiring) return;
    this.retiring = true;
    clearInterval(this.timer);
    this.server.close();
    try {
      await this.host.shutdown();
      this.host.close();
      this.lease.close();
      rmSync(this.socket, { force: true });
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }

  /** Parses one bounded control message; malformed input cannot mutate execution state. */
  private connection(socket: Socket): void {
    let data = '';
    socket.on('error', () => socket.destroy());
    socket.on('data', (chunk) => {
      data += String(chunk);
      if (Buffer.byteLength(data) > 1024 * 1024) {
        socket.destroy();
        return;
      }
      if (!data.includes('\n')) return;
      try {
        const value = this.dispatch(JSON.parse(data.split('\n')[0]!));
        socket.end(JSON.stringify({ value }) + '\n');
      } catch (error) {
        socket.end(
          JSON.stringify({ error: String(error), invalid: error instanceof InputError }) + '\n',
        );
      }
    });
  }

  /** Allows automatic authority replacement only after all executable runs have ended. */
  private retire(): boolean {
    if (this.retiring) return true;
    const status = this.host.status();
    if (
      status.active ||
      this.host.store
        .runs()
        .some(
          (run) =>
            run.data.pendingPublication ||
            !['completed', 'cancelled', 'failed', 'stopped'].includes(run.status),
        )
    )
      throw new Error('Active execution host cannot retire');
    this.retiring = true;
    setTimeout(() => {
      this.host.close();
      this.lease.close();
      process.exit(0);
    }, 50);
    return true;
  }

  /** Rejects invalid mode input and mutations after retirement before dispatch reaches runtime state. */
  private validate(request: HostRequest): void {
    if (this.retiring && !['identity', 'status', 'task-status', 'retire'].includes(request.action))
      throw new Error('Execution host is retiring; retry after ownership is released');
    if (
      !['identity', 'status', 'task-status', 'retire', 'stop', 'pause', 'cancel'].includes(
        request.action,
      )
    )
      ContainerLifetime.assertOpen(this.root);
    if (request.simulate !== undefined && typeof request.simulate !== 'boolean')
      throw new InputError('Simulation must be a boolean');
  }

  /** Routes explicit controls while keeping scheduling policy inside the host. */
  private dispatch(request: HostRequest): unknown {
    this.validate(request);
    if (request.action === 'identity') return this.identity();
    if (request.action === 'delivery-control')
      return this.host.publish(String(request.id), request.expectedRevision);
    if (request.action === 'workday-control')
      return this.host.workdayControl(
        String(request.control),
        String(request.id),
        request.expectedRevision,
      );
    if (request.action === 'task-control')
      return this.host.taskControl(
        String(request.control),
        String(request.id),
        request.answer,
        request.expectedRevision,
      );
    if (request.action === 'retire') return this.retire();
    if (request.action === 'submit')
      return this.host.submit(
        String(request.prompt ?? ''),
        request.simulate,
        request.expectedEnvironmentId,
      );
    if (request.action === 'task-status') return this.host.reports.view(String(request.id));
    return this.runControl(request);
  }

  /** Exposes a live process token for deployment shutdown without trusting retained PID files. */
  private identity() {
    return {
      ...this.context,
      hostCapabilities,
      runtime: { pid: process.pid, start: processStart(process.pid), root: resolve(this.root) },
    };
  }

  /** Handles direct run controls while resource mutations retain explicit identity checks. */
  private runControl(request: HostRequest): unknown {
    if (request.action === 'answer') {
      this.host.answer(String(request.id), String(request.answer));
      return true;
    }
    if (request.action === 'cancel') {
      this.host.cancel(String(request.id));
      return true;
    }
    return this.host.control(request.action, request.simulate);
  }
}

const [root, context, socket] = process.argv.slice(2);

if (!root || !context || !socket)
  throw new Error('Private execution host requires captured startup paths');

new HostServer(root, JSON.parse(readFileSync(context, 'utf8')), socket, context).start();
