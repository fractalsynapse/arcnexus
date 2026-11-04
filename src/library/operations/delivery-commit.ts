import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { execute, git } from './process.js';

/** Creates the same attributed verified commit in either environment without modifying the source checkout. */
export class DeliveryCommit {
  readonly ref: string;

  private readonly message: string;

  /** Captures immutable delivery identity and canonical host repository before permitting object writes. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly source: string,
    private readonly evidenceRoot: string,
    private readonly runner: typeof execute = execute,
  ) {
    this.delivery = structuredClone(delivery);
    if (
      delivery.engineering !== 'verified' ||
      !/^[a-f0-9]{64}$/.test(delivery.id) ||
      !/^[a-f0-9]{40,64}$/.test(delivery.base) ||
      !/^[a-f0-9]{40,64}$/.test(delivery.candidate) ||
      realpathSync(source) !== resolve(source)
    )
      throw new Error(
        'Delivery commit requires verified immutable attribution and canonical source',
      );
    this.ref = 'refs/arcnexus/deliveries/' + delivery.id;
    this.message = 'ArcNexus verified delivery ' + delivery.id;
  }

  /** Reuses an exact retained object or creates and atomically pins one deterministic commit. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    signal.throwIfAborted();
    const existing = this.inspect(effect);
    if (existing.status === 'completed') return existing.result;
    if (existing.status !== 'absent')
      throw new Error('Delivery commit conflicts with retained state');
    const tree = git(this.source, 'rev-parse', `${this.delivery.candidate}^{tree}`).trim();
    const head = (
      await this.command(
        effect,
        'commit',
        ['commit-tree', tree, '-p', this.delivery.base, '-m', this.message],
        signal,
      )
    ).trim();
    this.validate(this.source, head);
    await this.command(effect, 'pin', ['update-ref', this.ref, head, ''], signal);
    return this.receipt(head);
  }

  /** Recovers only a matching private ref; a conflicting object never becomes accepted evidence. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    const head = git(this.source, 'for-each-ref', '--format=%(objectname)', this.ref).trim();
    const evidence = `git:${this.delivery.environment.id}:${this.ref}`;
    if (!head) return { status: 'absent', evidence };
    try {
      this.validate(this.source, head);
      return { status: 'completed', evidence, result: this.receipt(head) };
    } catch (error) {
      return { status: 'rejected', evidence, reason: String(error) };
    }
  }

  /** Requires the captured tree, exactly one original parent and host attribution in any observed repository. */
  validate(repository: string, head: string): void {
    if (!/^[a-f0-9]{40,64}$/.test(head)) throw new Error('Invalid delivery commit');
    const actual = git(repository, 'show', '-s', '--format=%T%n%P%n%s', head).trim();
    const tree = git(this.source, 'rev-parse', `${this.delivery.candidate}^{tree}`).trim();
    if (actual !== [tree, this.delivery.base, this.message].join('\n'))
      throw new Error('Delivery commit does not match captured verified tree and attribution');
  }

  /** Rejects substituted environment, run, target or intent before any Git effect. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.operation !== 'delivery.commit' ||
      JSON.stringify(effect.input) !== JSON.stringify({ deliveryId: this.delivery.id })
    )
      throw new Error('Delivery commit intent is outside captured authority');
  }

  /** Preserves environment provenance while keeping the transport branch separate from the private object ref. */
  private receipt(head: string): Record<string, unknown> {
    return {
      deliveryId: this.delivery.id,
      head,
      ref: 'refs/heads/arcnexus/' + this.delivery.id,
      environmentId: this.delivery.environment.id,
      simulation: this.delivery.environment.mode === 'simulation',
    };
  }

  /** Executes only fixed object commands with supervised cancellation and exclusively created evidence. */
  private async command(
    effect: ExternalEffect,
    step: string,
    args: string[],
    signal: AbortSignal,
  ): Promise<string> {
    const directory = join(this.evidenceRoot, this.delivery.id, String(effect.attempt), step);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stdout = join(directory, 'stdout');
    const result = await this.runner(
      { command: 'git', args: ['-c', 'core.hooksPath=/dev/null', ...args] },
      this.source,
      join(directory, 'command.log'),
      signal,
      { processScope: true, stdout, env: this.environment() },
    );
    if (result.exitCode !== 0) throw new Error('Delivery Git failed; inspect ' + result.log);
    return readFileSync(stdout, 'utf8');
  }

  /** Fixes commit metadata and removes ambient network credentials and Git configuration overrides. */
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
