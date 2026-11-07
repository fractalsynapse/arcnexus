import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import { execute } from './process.js';

/** Supervises host-selected local Git object operations with stable metadata and private evidence. */
export class DeliveryCommands {
  /** Captures the source and evidence roots; provider adapters retain responsibility for validating each action. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly source: string,
    private readonly evidenceRoot: string,
    private readonly runner: typeof execute = execute,
  ) {}

  /** Retains exclusive command logs and denies remote protocols, hooks and ambient credential configuration. */
  async run(
    effect: ExternalEffect,
    step: string,
    args: string[],
    signal: AbortSignal,
    cwd = this.source,
  ): Promise<string> {
    const directory = join(
      this.evidenceRoot,
      this.delivery.id,
      effect.id,
      String(effect.attempt),
      step,
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stdout = join(directory, 'stdout');
    const result = await this.runner(
      { command: 'git', args: ['-c', 'core.hooksPath=/dev/null', ...args] },
      cwd,
      join(directory, 'command.log'),
      signal,
      { processScope: true, stdout, env: this.environment() },
    );
    if (result.exitCode !== 0) throw new Error('Delivery Git failed; inspect ' + result.log);
    return readFileSync(stdout, 'utf8');
  }

  /** Uses deterministic attribution in both environments without inheriting worker or personal credentials. */
  private environment(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'file',
      GIT_AUTHOR_NAME: 'ArcNexus delivery',
      GIT_AUTHOR_EMAIL: 'delivery@arcnexus.invalid',
      GIT_COMMITTER_NAME: 'ArcNexus delivery',
      GIT_COMMITTER_EMAIL: 'delivery@arcnexus.invalid',
      GIT_AUTHOR_DATE: this.delivery.createdAt,
      GIT_COMMITTER_DATE: this.delivery.createdAt,
    };
  }
}
