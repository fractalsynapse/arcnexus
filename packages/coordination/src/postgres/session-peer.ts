import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, constants, mkdtempSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReply, sendFrame, type SessionRequest } from './session-protocol.js';

type Descriptor = { input: number; output: number };
type Channel = { parent: Descriptor; worker: ChildProcess };

function pipe(path: string) {
  const hold = openSync(path, constants.O_RDWR | constants.O_NONBLOCK);
  try {
    const input = openSync(path, constants.O_RDONLY);
    try {
      return { input, output: openSync(path, constants.O_WRONLY) };
    } catch (error) {
      closeSync(input);
      throw error;
    }
  } finally {
    closeSync(hold);
  }
}

function channel(): Channel {
  const directory = mkdtempSync(join(tmpdir(), 'arc-writer-'));
  const requests = join(directory, 'requests');
  const replies = join(directory, 'replies');
  try {
    execFileSync('/usr/bin/mkfifo', ['-m', '600', requests, replies]);
    return spawnPeer(pipe(requests), () => pipe(replies));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function spawnPeer(transmit: Descriptor, prepare: () => Descriptor): Channel {
  let receive: Descriptor | undefined;
  try {
    receive = prepare();
    const program = fileURLToPath(new URL('./session-worker.js', import.meta.url));
    const worker = spawn(process.execPath, [program], {
      env: {},
      stdio: [transmit.input, receive.output, 'ignore'],
    });
    closeSync(transmit.input);
    closeSync(receive.output);
    return { parent: { input: receive.input, output: transmit.output }, worker };
  } catch (error) {
    for (const descriptor of [transmit, receive]) {
      if (descriptor) {
        closeSync(descriptor.input);
        closeSync(descriptor.output);
      }
    }
    throw error;
  }
}

/** Keep one PostgreSQL session behind the Host's synchronous receipt boundary. */
export class SessionPeer {
  private readonly lifetime = new AbortController();
  readonly signal = this.lifetime.signal;
  private readonly pipe = channel();
  private closed = false;

  /** Detect both failed startup and loss while work runs. */
  constructor() {
    this.pipe.worker.once('error', (error) => this.lifetime.abort(error));
    this.pipe.worker.once('exit', () =>
      this.lifetime.abort(new Error('PostgreSQL writer session disconnected')),
    );
  }

  /** Return each committed result before the caller can perform its next effect. */
  request(request: SessionRequest) {
    this.signal.throwIfAborted();
    let reply;
    try {
      sendFrame(this.pipe.parent.output, request);
      reply = readReply(this.pipe.parent.input);
    } catch (error) {
      this.lifetime.abort(error);
      throw error;
    }
    if (!reply.ok) throw new Error(reply.error);
    return reply.result;
  }

  /** Revoke the local session when the durable lease no longer matches. */
  invalidate(error: Error): never {
    this.lifetime.abort(error);
    throw error;
  }

  /** Release descriptors and let the peer close its dedicated connection. */
  close() {
    if (this.closed) return;
    try {
      if (!this.signal.aborted) this.request({ kind: 'close' });
    } finally {
      this.closed = true;
      this.lifetime.abort(new Error('PostgreSQL writer session closed'));
      closeSync(this.pipe.parent.input);
      closeSync(this.pipe.parent.output);
    }
  }
}
