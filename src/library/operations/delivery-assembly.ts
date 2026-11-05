import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import { git } from './process.js';
import { DeliveryCommit } from './delivery-commit.js';
import { DeliveryCommands } from './delivery-commands.js';

/** Assembles verified delivery objects against an exact target without changing either checkout or upstream. */
export class DeliveryAssembly {
  private readonly commits: DeliveryCommit;

  private readonly commands: DeliveryCommands;

  /** Binds object validation and supervised Git to the captured delivery and host-owned repository. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly source: string,
    evidenceRoot: string,
  ) {
    this.delivery = structuredClone(delivery);
    this.commits = new DeliveryCommit(this.delivery, source, evidenceRoot);
    this.commands = new DeliveryCommands(this.delivery, source, evidenceRoot);
  }

  /** Retains merge conflicts and pins only a deterministic object with both captured parents. */
  async assemble(effect: ExternalEffect, head: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    this.assert(effect);
    this.commits.validate(this.source, head);
    this.assertTargetContainsBase(effect);
    const prior = git(
      this.source,
      'for-each-ref',
      '--format=%(objectname)',
      this.ref(effect),
    ).trim();
    if (prior) {
      this.validate(effect, head, prior);
      return prior;
    }
    return this.create(effect, head, signal);
  }

  /** Creates a fresh merge tree and pins the attributed commit only after successful object validation. */
  private async create(effect: ExternalEffect, head: string, signal: AbortSignal): Promise<string> {
    const target = String(effect.input.targetHead);
    const merged = await this.commands.run(
      effect,
      'merge-tree',
      ['merge-tree', '--write-tree', target, head],
      signal,
    );
    const tree = merged.split('\n')[0]!.trim();
    if (!/^[a-f0-9]{40,64}$/.test(tree)) throw new Error('Invalid assembled tree');
    const args = ['commit-tree', tree, '-p', target, '-p', head, '-m', this.message()];
    const commit = (await this.commands.run(effect, 'merge-commit', args, signal)).trim();
    this.validate(effect, head, commit);
    await this.commands.run(
      effect,
      'pin-merge',
      ['update-ref', this.ref(effect), commit, ''],
      signal,
    );
    return commit;
  }

  /** Rejects redirected or mismatched retained merge objects before they can be reused for verification. */
  validate(effect: ExternalEffect, head: string, assembled: string): void {
    this.assert(effect);
    this.assertTargetContainsBase(effect);
    this.commits.validate(this.source, head);
    if (!/^[a-f0-9]{40,64}$/.test(assembled)) throw new Error('Invalid assembled commit');
    const actual = git(this.source, 'show', '-s', '--format=%P%n%s', assembled).trim();
    if (actual !== [String(effect.input.targetHead) + ' ' + head, this.message()].join('\n'))
      throw new Error('Assembled merge differs from captured parents or attribution');
  }

  /** Rejects targets that a two-parent merge would advance through unreviewed source history. */
  private assertTargetContainsBase(effect: ExternalEffect): void {
    const target = String(effect.input.targetHead);
    if (git(this.source, 'rev-list', '--max-count=1', this.delivery.base, '--not', target).trim())
      throw new Error(
        'Integration target lacks the verified delivery base; reconcile before merging',
      );
  }

  /** Names private assembly evidence by the complete durable intent digest, not a mutable source branch. */
  private ref(effect: ExternalEffect): string {
    return 'refs/arcnexus/merges/' + effect.inputDigest;
  }

  /** Preserves simulation vocabulary while making live object provenance explicit. */
  private message(): string {
    return (
      'ArcNexus ' +
      (this.delivery.environment.mode === 'simulation' ? 'simulated' : 'verified') +
      ' merge ' +
      this.delivery.id
    );
  }

  /** Requires exact host-supplied target identity and rejects cross-run or malformed assembly intent. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.operation !== 'pull-request.merge' ||
      effect.input.deliveryId !== this.delivery.id ||
      !/^[a-f0-9]{40,64}$/.test(String(effect.input.targetHead)) ||
      !/^[a-f0-9]{64}$/.test(effect.inputDigest) ||
      Object.keys(effect.input).some((key) => !['deliveryId', 'targetHead'].includes(key))
    )
      throw new Error('Merge assembly intent is outside captured authority');
  }
}
