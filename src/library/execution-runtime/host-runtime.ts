import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Starts the installed application for both new work and ordinary checkpoint recovery. */
export class HostRuntime {
  private readonly directory = fileURLToPath(new URL('../../../', import.meta.url));

  /** Records installed executable identity without copying or pinning an executable per run. */
  describe(): { directory: string; hash: string } {
    const hash = createHash('sha256');
    for (const path of ['dist', 'package.json', 'package-lock.json']) this.hash(path, hash);
    return { directory: this.directory, hash: hash.digest('hex') };
  }

  /** Retains legacy host identity as provenance while recording the installed runtime in one ledger. */
  record(store: ExecutionStore, project: string) {
    const runtime = this.describe();
    const metadata = join(project, 'host.json');
    const previous = existsSync(metadata)
      ? JSON.parse(readFileSync(metadata, 'utf8')).runner
      : undefined;
    store.recordRuntime(runtime, previous);
    return runtime;
  }

  /** Uses one detached launch path; the host validates durable state before dispatch. */
  launch(root: string, context: string, socket: string): void {
    const log = openSync(join(dirname(context), 'host.log'), 'a', 0o600);
    try {
      spawn(
        process.execPath,
        [
          join(this.directory, 'dist/library/execution-runtime/host-main.js'),
          root,
          context,
          socket,
        ],
        { detached: true, stdio: ['ignore', log, log] },
      ).unref();
    } finally {
      closeSync(log);
    }
  }

  /** Fingerprints executable files and declared dependencies for honest transition evidence. */
  private hash(path: string, hash: ReturnType<typeof createHash>): void {
    const absolute = join(this.directory, path);
    const stat = statSync(absolute);
    hash.update(JSON.stringify([path, stat.mode & 0o777]));
    if (stat.isDirectory())
      for (const name of readdirSync(absolute).sort()) this.hash(join(path, name), hash);
    else if (stat.isFile()) hash.update(readFileSync(absolute));
    else throw new Error('Unsupported installed runtime input: ' + absolute);
  }
}
