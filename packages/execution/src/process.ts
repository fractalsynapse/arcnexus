import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import type { Readable } from 'node:stream';

/** Run a managed host process and retain its complete output in the supplied log. */
export async function execute(
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    signal: AbortSignal;
    log?: string;
    input?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  options.signal.throwIfAborted();
  if (options.log) appendFileSync(options.log, '', { mode: 0o600 });
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    env: options.env,
    stdio: 'pipe',
  });
  child.stdin.on('error', () => {});
  child.stdin.end(options.input);
  return observe(child, options.signal, options.log);
}

/** Retain the streams and wait for the full process group to release its pipes. */
function observe(child: ChildProcessWithoutNullStreams, signal: AbortSignal, log?: string) {
  const stdout = collect(child.stdout, log);
  const stderr = collect(child.stderr, log);
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const stop = () => {
        if (child.pid) kill(child.pid);
      };
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
      child.once('error', reject);
      child.once('close', (status) => {
        signal.removeEventListener('abort', stop);
        if (signal.aborted) reject(signal.reason);
        else resolve({ status, stdout: stdout(), stderr: stderr() });
      });
    },
  );
}

/** Preserve bytes through chunk boundaries and flush a readable transcript as work executes. */
function collect(stream: Readable, log?: string) {
  let text = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    text += chunk;
    if (log) appendFileSync(log, chunk, { mode: 0o600 });
  });
  return () => text;
}

/** Stop the managed process group, including descendants that still hold pipes. */
function kill(pid: number) {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
