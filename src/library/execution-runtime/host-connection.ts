import type { RunStance } from '../coordination-store/execution-types.js';
import { connect, type Socket } from 'node:net';
import { InputError } from '../architecture/config.js';

export interface HostRequest {
  /** Early-stop stance retained by the host so a plan run cannot dispatch work. */
  stance?: RunStance;
  action: string;
  simulate?: boolean;
  prompt?: string;
  id?: string;
  answer?: string;
  control?: string;
  expectedRevision?: string;
  expectedEnvironmentId?: string;
}

/** Sends private IPC requests independently of source checkout discovery or host creation. */
export class HostConnection {
  /** Retains the resolved endpoint without touching durable state. */
  constructor(private readonly socket: string) {}

  /** Sends one structured control request and surfaces host-side errors or caller cancellation. */
  request(request: HostRequest, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const socket = connect(this.socket);
    return new Promise((resolve, reject) =>
      this.exchange(socket, request, signal, resolve, reject),
    );
  }

  /** Connects request listeners and removes cancellation state after one response. */
  private exchange(
    socket: Socket,
    request: HostRequest,
    signal: AbortSignal | undefined,
    resolve: (value: any) => void,
    reject: (error: Error) => void,
  ): void {
    let data = '';
    const abort = () => socket.destroy(new Error('Operation cancelled'));
    const cleanup = () => signal?.removeEventListener('abort', abort);
    if (request.action === 'identity')
      socket.setTimeout(5000, () =>
        socket.destroy(new Error('Host discovery transport timed out')),
      );
    signal?.addEventListener('abort', abort, { once: true });
    socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'));
    socket.on('error', (error) => {
      cleanup();
      reject(error);
    });
    socket.on('data', (chunk) => {
      data = this.receive(socket, data, chunk, cleanup, resolve, reject);
    });
    socket.on('end', () => {
      cleanup();
      if (!data.includes('\n')) reject(new Error('Host disconnected before response'));
    });
  }

  /** Parses one complete newline-delimited response and closes its transport. */
  private receive(
    socket: Socket,
    data: string,
    chunk: Buffer,
    cleanup: () => void,
    resolve: (value: any) => void,
    reject: (error: Error) => void,
  ): string {
    const responseData = data + String(chunk);
    if (!responseData.includes('\n')) return responseData;
    socket.end();
    cleanup();
    try {
      const response = JSON.parse(responseData.split('\n')[0]!);
      if (response.error)
        reject(response.invalid ? new InputError(response.error) : new Error(response.error));
      else resolve(response.value);
    } catch (error) {
      reject(error as Error);
    }
    return responseData;
  }
}
