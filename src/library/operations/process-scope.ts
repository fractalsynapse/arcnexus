import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { Command } from '../architecture/config.js';

/** Contains confined descendants independently of session changes and process reparenting. */
export class ProcessScope {
  readonly path: string;

  private closed = false;

  /** Creates an exclusive delegated kernel scope and verifies kill support before dispatch. */
  constructor() {
    const entry = readFileSync('/proc/self/cgroup', 'utf8')
      .split('\n')
      .find((s) => s.startsWith('0::'));
    if (!entry || entry.slice(3).split('/').includes('..'))
      throw new Error('Confined execution requires a delegated cgroup-v2 scope');
    const parent = realpathSync('/sys/fs/cgroup' + entry.slice(3));
    this.path = join(parent, 'arcnexus-' + randomUUID());
    mkdirSync(this.path);
    try {
      this.kill();
    } catch (error) {
      rmdirSync(this.path);
      throw error;
    }
  }

  /** Places the trusted launcher in the scope before it starts the captured sandbox executable. */
  command(command: Command): Command {
    return {
      command: process.execPath,
      args: [
        fileURLToPath(new URL('./scope-launcher.js', import.meta.url)),
        this.path,
        command.command,
        ...command.args,
      ],
    };
  }

  /** Uses the kernel's fork-safe tree kill instead of polling and signalling reusable process IDs. */
  kill(): void {
    if (!this.closed) writeFileSync(join(this.path, 'cgroup.kill'), '1');
  }

  /** Waits for kernel-confirmed emptiness before removing this exclusive scope. */
  async close(): Promise<void> {
    while (!this.closed) {
      this.kill();
      if (!/^populated 1$/m.test(readFileSync(join(this.path, 'cgroup.events'), 'utf8'))) {
        try {
          rmdirSync(this.path);
          this.closed = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
        }
      }
      if (!this.closed) await delay(10);
    }
  }
}
