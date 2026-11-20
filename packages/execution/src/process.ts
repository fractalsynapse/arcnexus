import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import type { Readable } from 'node:stream';

export interface ProcessObservation {
  channel: 'stdout' | 'stderr';
  text: string;
}

interface ProcessOptions {
  cwd: string;
  signal: AbortSignal;
  log?: string;
  stderrLog?: string;
  input?: string;
  env?: NodeJS.ProcessEnv;
  output?(event: ProcessObservation): void;
  captureOutput?: boolean;
}

/** Run a managed host process and retain complete output while forwarding observed data. */
export async function execute(
  command: string,
  args: readonly string[],
  options: ProcessOptions,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  options.signal.throwIfAborted();
  for (const file of new Set([options.log, options.stderrLog]))
    if (file) appendFileSync(file, '', { mode: 0o600 });
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    env: options.env,
    stdio: 'pipe',
  });
  child.stdin.on('error', () => {});
  child.stdin.end(options.input);
  return observe(child, options);
}

/** Preserve stream provenance and propagate a failed observer through managed cancellation. */
class ProcessOutput {
  readonly text = { stdout: '', stderr: '' };
  failure?: unknown;

  /** Attach listeners before process output and retain the requested channel files. */
  constructor(
    child: ChildProcessWithoutNullStreams,
    private readonly options: ProcessOptions,
    private readonly stop: () => void,
  ) {
    this.capture(child.stdout, 'stdout', options.log);
    this.capture(child.stderr, 'stderr', options.stderrLog ?? options.log);
  }

  /** Decode Unicode across pipe boundaries and retain data before notifying the caller. */
  private capture(stream: Readable, channel: ProcessObservation['channel'], log?: string) {
    stream.setEncoding('utf8');
    stream.on('data', (text: string) => {
      try {
        if (this.options.captureOutput !== false) this.text[channel] += text;
        if (log) appendFileSync(log, text, { mode: 0o600 });
        this.options.output?.({ channel, text });
      } catch (error) {
        this.failure = error;
        this.stop();
      }
    });
  }
}

/** Wait for descendants to release the pipes before reporting completion or an observation failure. */
function observe(child: ChildProcessWithoutNullStreams, options: ProcessOptions) {
  const { signal } = options;
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const stop = () => {
        if (child.pid) kill(child.pid);
      };
      const output = new ProcessOutput(child, options, stop);
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
      child.once('error', reject);
      child.once('close', (status) => {
        signal.removeEventListener('abort', stop);
        if (signal.aborted) reject(signal.reason);
        else if (output.failure !== undefined) reject(output.failure);
        else resolve({ status, ...output.text });
      });
    },
  );
}

/** Stop the managed process group, including descendants that still hold pipes. */
function kill(pid: number) {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
