import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { installedRuntime } from '../operations/installed-runtime.js';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Starts the installed application for both new work and ordinary checkpoint recovery. */
export class HostRuntime {
  private readonly directory = fileURLToPath(new URL('../../../', import.meta.url));

  /** Records installed executable identity without copying or pinning an executable per run. */
  describe(): { directory: string; hash: string } {
    return installedRuntime();
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
}
