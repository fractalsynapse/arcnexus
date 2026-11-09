import { join } from 'node:path';
import type { RepositoryMaterialization } from '../architecture/bindings.js';
import type { DeliveryRecord, DeliveryMilestone } from '../coordination-store/delivery-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import { ProviderStore } from '../coordination-store/provider-store.js';
import type { CheckResult } from '../operations/check-result.js';
import { DeliveryGit } from '../operations/delivery-git.js';
import { SimulatedPullRequests } from '../operations/simulated-pull-requests.js';
import { SimulatedReleases } from '../operations/simulated-releases.js';
import { PublicationEffects } from './publication-effects.js';
import type { CapturedPublicationPolicy } from './publication-policy.js';

export interface SimulationPublicationContext {
  root: string;
  checkAttempt?: string;
  repositoryId: string;
  repository: RepositoryMaterialization;
  effects: LifecycleStore;
  deliveries: DeliveryStore;
  policy: CapturedPublicationPolicy;
  checks: (head: string, signal: AbortSignal, independent?: boolean) => Promise<CheckResult>;
}

const actions = [
  'delivery.commit',
  'delivery.push',
  'pull-request.create',
  'pull-request.check',
  'pull-request.merge',
  'release.create',
];

/** Advances simulated deliveries through the same durable effects, actual Git, checks and independent verification. */
export class SimulationPublication {
  private readonly provider: ProviderStore;

  private readonly git: DeliveryGit;

  private readonly prs: SimulatedPullRequests;

  private readonly releases: SimulatedReleases;

  private readonly executor: PublicationEffects;

  /** Captures host policy once and exposes no caller-supplied command, target or artifact overrides. */
  constructor(
    private readonly context: SimulationPublicationContext,
    private readonly delivery: DeliveryRecord,
  ) {
    this.delivery = structuredClone(delivery);
    this.context = {
      ...context,
      policy: structuredClone(context.policy),
      repository: structuredClone(context.repository),
    };
    const { root, repositoryId, repository, checks } = this.context;
    this.assertPolicy();
    this.provider = new ProviderStore(join(root, 'provider.sqlite'));
    this.git = new DeliveryGit(delivery, repositoryId, repository, join(root, 'publication'));
    this.prs = new SimulatedPullRequests(delivery, this.provider, this.git, checks);
    this.releases = new SimulatedReleases(delivery, this.provider, join(root, 'artifacts'));
    this.executor = this.execution();
  }

  /** Retains completed milestones on failure and requires exact-revision authorization before integration. */
  async publish(signal: AbortSignal): Promise<DeliveryRecord> {
    try {
      await this.step('commit', 'delivery.commit', signal);
      await this.step('push', 'delivery.push', signal);
      await this.step('pull_request', 'pull-request.create', signal);
      const check = await this.effect('pull-request.check', signal);
      if (check.result!.checks !== 'passed') throw new Error('Publication checks failed');
      this.assertApproval();
      const merged = await this.effect('pull-request.merge', signal);
      if (merged.result!.merged !== true) throw new Error('Assembled delivery verification failed');
      this.complete('merge', merged.id);
      await this.step('release', 'release.create', signal);
      return this.current();
    } catch (error) {
      const current = this.current();
      this.context.deliveries.block(current.id, current.version, String(error));
      throw error;
    }
  }

  /** Releases provider state without closing the supervising host's shared stores. */
  close(): void {
    this.provider.close();
  }

  /** Routes every lifecycle step through the same immutable environment and write-ahead protocol. */
  private execution(): PublicationEffects {
    const { environment } = this.delivery;
    return new PublicationEffects(
      this.context.effects,
      this.context.deliveries,
      this.delivery,
      {
        id: this.context.effects.environment(environment.id).providerId,
        mode: 'simulation',
        apply: (effect, signal) => this.adapter(effect).apply(effect, signal),
        inspect: async (effect) => this.adapter(effect).inspect(effect),
      },
      this.context.policy.operation.definitionDigest!,
      actions,
    );
  }

  /** Selects a provider implementation without changing scheduling, verification or effect semantics. */
  private adapter(effect: ExternalEffect) {
    if (effect.operation.startsWith('delivery.')) return this.git;
    if (effect.operation.startsWith('pull-request.')) return this.prs;
    return this.releases;
  }

  /** Uses stable per-delivery request identities and reconciles uncertainty before considering retry. */
  private async effect(
    operation: string,
    signal: AbortSignal,
    extra: Record<string, unknown> = {},
  ) {
    if (operation === 'pull-request.check' && this.context.checkAttempt)
      return this.executor.refreshChecks(
        this.context.checkAttempt,
        signal,
        (check) =>
          check.definitionDigest === this.context.policy.operation.definitionDigest &&
          this.prs.currentCheck(check),
      );
    const target = operation === 'pull-request.merge' ? { targetHead: this.git.targetHead() } : {};
    return this.executor.effect(operation, signal, { ...extra, ...target });
  }

  /** Records a milestone only after a completed provider receipt exists. */
  private async step(milestone: DeliveryMilestone, operation: string, signal: AbortSignal) {
    const effect = await this.effect(operation, signal);
    this.complete(milestone, effect.id);
  }

  /** Keeps milestone persistence idempotent across a crash after the external effect completes. */
  private complete(milestone: DeliveryMilestone, effectId: string): void {
    this.executor.complete(milestone, effectId);
  }

  /** Reads authorization and lifecycle state freshly so intervening approval is not lost. */
  private current(): DeliveryRecord {
    return this.context.deliveries.get(this.delivery.id);
  }

  /** Treats local approval as exact-revision authorization, never as a provider review. */
  private assertApproval(): void {
    if (this.context.policy.operation.automaticMerge === true) return;
    if (this.current().approval?.candidate !== this.delivery.candidate)
      throw new Error('Delivery requires approval for the captured candidate revision');
  }

  /** Rejects missing, changed or cross-repository publication authority before creating provider state. */
  private assertPolicy(): void {
    const policy = this.context.policy.operation;
    if (
      this.delivery.environment.mode !== 'simulation' ||
      policy.action !== 'delivery.publish' ||
      policy.repository !== this.context.repositoryId ||
      !policy.definitionDigest ||
      policy.targetBranch !== this.delivery.target.branch
    )
      throw new Error('Publication policy does not match captured delivery authority');
  }
}
