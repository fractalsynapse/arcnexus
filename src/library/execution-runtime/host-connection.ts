import { connect } from 'node:net';
import { InputError } from '../architecture/config.js';

export interface HostRequest {
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

  /** Sends a single structured control request and surfaces host-side errors. */
  request(request: HostRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = connect(this.socket);
      let data = '';
      if (request.action === 'identity')
        socket.setTimeout(5000, () =>
          socket.destroy(new Error('Host discovery transport timed out')),
        );
      socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'));
      socket.on('error', reject);
      socket.on('data', (chunk) => {
        data += String(chunk);
        if (!data.includes('\n')) return;
        socket.end();
        try {
          const response = JSON.parse(data.split('\n')[0]!);
          if (response.error)
            reject(response.invalid ? new InputError(response.error) : new Error(response.error));
          else resolve(response.value);
        } catch (error) {
          reject(error);
        }
      });
      socket.on('end', () => {
        if (!data.includes('\n')) reject(new Error('Host disconnected before response'));
      });
    });
  }
}
