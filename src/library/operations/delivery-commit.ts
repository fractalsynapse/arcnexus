import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { execute, git } from './process.js';
import { DeliveryCommands } from './delivery-commands.js';

/** Resolves the captured steward branch, retaining the original spelling for historical deliveries. */
export function deliveryBranch(delivery: DeliveryRecord): string {
  const development = delivery.development;
  if (!development) return 'arcnexus/' + delivery.id;
  if (
    !/^codex\/run-[a-f0-9-]{36}$/.test(development.branch) ||
    development.base !== delivery.base ||
    development.candidate !== delivery.candidate ||
    delivery.assignmentIds.length !== 1 ||
    delivery.assignmentIds[0] !== development.assignmentId ||
    delivery.candidateRecordId !== development.recordId ||
    !delivery.parentDeliveryId
  )
    throw new Error('Invalid captured development branch attribution');
  return development.branch;
}

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
    deliveryBranch(delivery);
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
    if (this.delivery.development) {
      await this.developmentBranch(effect, signal);
      await this.commands.run(
        effect,
        'pin',
        ['update-ref', this.ref, this.delivery.candidate, ''],
        signal,
      );
      return this.receipt(this.delivery.candidate);
    }
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
      if (
        this.delivery.development &&
        git(this.source, 'rev-parse', 'refs/heads/' + deliveryBranch(this.delivery)).trim() !== head
      )
        throw new Error('Retained steward branch differs from its delivery');
      return { status: 'completed', evidence, result: this.receipt(head) };
    } catch (error) {
      return { status: 'rejected', evidence, reason: String(error) };
    }
  }

  /** Detaches the completed worktree before advancing its original branch with a checked reference update. */
  private async developmentBranch(effect: ExternalEffect, signal: AbortSignal): Promise<void> {
    this.validate(this.source, this.delivery.candidate);
    const ref = 'refs/heads/' + deliveryBranch(this.delivery);
    const head = git(this.source, 'rev-parse', '--verify', ref).trim();
    if (head === this.delivery.candidate) return;
    if (head !== this.delivery.base) throw new Error('Steward development branch changed');
    const worktrees = git(this.source, 'worktree', 'list', '--porcelain').split('\n\n');
    const attached = worktrees.find((entry) => entry.split('\n').includes('branch ' + ref));
    if (attached) {
      const path = attached.split('\n')[0]!.slice('worktree '.length);
      await this.commands.run(
        effect,
        'detach-completed-workspace',
        ['switch', '--detach', this.delivery.base],
        signal,
        path,
      );
    }
    await this.commands.run(
      effect,
      'commit-development-branch',
      ['update-ref', ref, this.delivery.candidate, this.delivery.base],
      signal,
    );
  }

  /** Requires the captured tree, exactly one original parent and host attribution in any observed repository. */
  validate(repository: string, head: string): void {
    if (!/^[a-f0-9]{40,64}$/.test(head)) throw new Error('Invalid delivery commit');
    if (this.delivery.development) {
      deliveryBranch(this.delivery);
      if (
        head !== this.delivery.candidate ||
        git(repository, 'show', '-s', '--format=%P', head).trim() !== this.delivery.base
      )
        throw new Error('Development commit differs from its verified candidate or parent');
      return;
    }
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
      ref: 'refs/heads/' + deliveryBranch(this.delivery),
      environmentId: this.delivery.environment.id,
      simulation: this.delivery.environment.mode === 'simulation',
    };
  }
}
