import { realpathSync } from 'node:fs';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import { DeliveryCommands } from './delivery-commands.js';
import { git } from './process.js';

/** Applies only attributed simulation changes to a current target, without granting verification or publication. */
export class PromotionAssembly {
  private readonly commands: DeliveryCommands;

  /** Captures host-selected repositories and immutable simulation attribution, excluding filesystem aliases. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly simulation: string,
    private readonly target: string,
    evidenceRoot: string,
  ) {
    this.delivery = structuredClone(delivery);
    if (
      delivery.environment.mode !== 'simulation' ||
      delivery.engineering !== 'verified' ||
      !/^[a-f0-9]{64}$/.test(delivery.id) ||
      !this.revision(delivery.base) ||
      !this.revision(delivery.candidate) ||
      realpathSync(simulation) !== simulation ||
      realpathSync(target) !== target ||
      simulation === target ||
      !this.isolated()
    )
      throw new Error('Promotion requires isolated captured simulation and target repositories');
    this.commands = new DeliveryCommands(this.delivery, target, evidenceRoot);
  }

  /** Rejects linked worktrees sharing Git administration despite having different checkout paths. */
  private isolated(): boolean {
    const common = (path: string) =>
      realpathSync(git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim());
    return common(this.simulation) !== common(this.target);
  }

  /** Reuses a pinned candidate or assembles a new one while preserving every source and target branch. */
  async assemble(effect: ExternalEffect, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    this.assert(effect);
    const prior = git(
      this.target,
      'for-each-ref',
      '--format=%(objectname)',
      this.ref(effect),
    ).trim();
    if (prior) {
      this.validate(effect, prior);
      return prior;
    }
    await this.import(effect, signal);
    const tree = await this.reconcile(effect, signal);
    return this.candidate(effect, tree, signal);
  }

  /** Pins an unverified result parented only by the real target, retaining deterministic attribution. */
  private async candidate(
    effect: ExternalEffect,
    tree: string,
    signal: AbortSignal,
  ): Promise<string> {
    const result = await this.commands.run(
      effect,
      'promotion-candidate',
      ['commit-tree', tree, '-p', String(effect.input.targetHead), '-m', this.message(effect)],
      signal,
    );
    const candidate = result.trim();
    this.validate(effect, candidate);
    await this.commands.run(
      effect,
      'pin-promotion',
      ['update-ref', this.ref(effect), candidate, ''],
      signal,
    );
    return candidate;
  }

  /** Imports local objects without changing FETCH_HEAD, tracking refs, checkout bytes or credentials. */
  private async import(effect: ExternalEffect, signal: AbortSignal): Promise<void> {
    await this.commands.run(
      effect,
      'import-simulation',
      [
        'fetch',
        '--no-tags',
        '--no-write-fetch-head',
        '--no-recurse-submodules',
        '--',
        this.simulation,
        this.delivery.base,
        this.delivery.candidate,
      ],
      signal,
    );
    const revisions = {
      base: this.delivery.base,
      incoming: this.delivery.candidate,
      target: String(effect.input.targetHead),
    };
    for (const [name, revision] of Object.entries(revisions))
      await this.commands.run(
        effect,
        'retain-' + name,
        ['update-ref', this.ref(effect) + '-' + name, revision, ''],
        signal,
      );
  }

  /** Uses an explicit common base so simulation baseline history cannot become part of the promoted diff. */
  private async reconcile(effect: ExternalEffect, signal: AbortSignal): Promise<string> {
    const current = await this.side(effect, 'current', String(effect.input.targetHead), signal);
    const incoming = await this.side(effect, 'incoming', this.delivery.candidate, signal);
    const merged = await this.commands.run(
      effect,
      'promotion-merge',
      ['merge-tree', '--write-tree', current, incoming],
      signal,
    );
    const tree = merged.split('\n')[0]!.trim();
    if (!this.revision(tree)) throw new Error('Invalid promotion tree');
    return tree;
  }

  /** Reparents a tree privately for three-way comparison, never importing baseline history into the result. */
  private async side(
    effect: ExternalEffect,
    name: string,
    revision: string,
    signal: AbortSignal,
  ): Promise<string> {
    const tree = git(this.target, 'rev-parse', revision + '^{tree}').trim();
    return (
      await this.commands.run(
        effect,
        'promotion-' + name,
        ['commit-tree', tree, '-p', this.delivery.base, '-m', 'Private promotion comparison'],
        signal,
      )
    ).trim();
  }

  /** Requires a distinct promotion intent and exact revisions rather than a mutable ref or simulation mode change. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.operation !== 'delivery.promote' ||
      effect.environmentId === this.delivery.environment.id ||
      !effect.environmentId ||
      effect.runId === this.delivery.runId ||
      !effect.runId ||
      effect.input.deliveryId !== this.delivery.id ||
      !this.revision(String(effect.input.targetHead)) ||
      !/^[a-f0-9]{64}$/.test(effect.inputDigest) ||
      Object.keys(effect.input).some((key) => !['deliveryId', 'targetHead'].includes(key))
    )
      throw new Error('Promotion intent must capture a new run, environment and exact target');
  }

  /** Detects substituted retained parents or provenance before reusing private candidate evidence. */
  private validate(effect: ExternalEffect, candidate: string): void {
    if (!this.revision(candidate)) throw new Error('Invalid promotion candidate');
    const actual = git(this.target, 'show', '-s', '--format=%P%n%s', candidate).trim();
    if (actual !== String(effect.input.targetHead) + '\n' + this.message(effect))
      throw new Error('Promotion candidate differs from captured target or attribution');
  }

  /** Names private evidence by the complete durable promotion intent. */
  private ref(effect: ExternalEffect): string {
    return 'refs/arcnexus/promotions/' + effect.inputDigest;
  }

  /** Marks assembly as unverified while preserving its original immutable delivery identity. */
  private message(effect: ExternalEffect): string {
    return `ArcNexus promotion candidate ${this.delivery.id} ${effect.inputDigest}`;
  }

  /** Accepts object identities only, excluding revision expressions and option injection. */
  private revision(value: string): boolean {
    return /^[a-f0-9]{40,64}$/.test(value);
  }
}
