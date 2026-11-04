import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { execute, git } from './process.js';
import { DeliveryCommands } from './delivery-commands.js';

/** Creates the same attributed verified commit in either environment without modifying the source checkout. */
export class DeliveryCommit {
  readonly ref: string;

  private readonly message: string;

  private readonly commands: DeliveryCommands;

  /** Captures immutable delivery identity and canonical host repository before permitting object writes. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly source: string,
    evidenceRoot: string,
    runner: typeof execute = execute,
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
    this.commands = new DeliveryCommands(this.delivery, source, evidenceRoot, runner);
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
      await this.commands.run(
        effect,
        'commit',
        ['commit-tree', tree, '-p', this.delivery.base, '-m', this.message],
        signal,
      )
    ).trim();
    this.validate(this.source, head);
    await this.commands.run(effect, 'pin', ['update-ref', this.ref, head, ''], signal);
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
}
