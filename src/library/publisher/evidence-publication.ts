import { join } from 'node:path';
import type { RepositoryMaterialization } from '../architecture/bindings.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import { ProviderStore } from '../coordination-store/provider-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { DeliveryGit } from '../operations/delivery-git.js';
import { SimulatedPullRequests } from '../operations/simulated-pull-requests.js';
import { SimulatedReleases } from '../operations/simulated-releases.js';
import type { CapturedPublicationPolicy } from './publication-policy.js';
import type { PublicationContext, PublicationProvider } from './publication.js';

/** Isolated repositories and captured artifacts for a namespace with no upstream. */
export interface EvidencePublicationContext extends PublicationContext {
  repository: RepositoryMaterialization;
  checkAttempt?: string;
}

const actions = [
  'delivery.commit',
  'delivery.push',
  'pull-request.create',
  'pull-request.check',
  'pull-request.merge',
  'release.create',
];

/**
 * Publishes a simulated delivery into its own namespace: real Git, real checks, captured record.
 *
 * There is no remote here. The branch and merge commit are actual objects, the gate runs the
 * declared checks for real, and the change record holds the reviewer evidence that gate produced —
 * captured rather than imitated, so the state a later reader sees is a record of what happened. The
 * release step records artifacts and provenance locally and never claims a registry or a tag.
 */
export class EvidencePublicationProvider implements PublicationProvider {
  readonly mode = 'simulation' as const;

  readonly actions = actions;

  private readonly provider: ProviderStore;

  private readonly git: DeliveryGit;

  private readonly prs: SimulatedPullRequests;

  private readonly releases: SimulatedReleases;

  /** Binds one isolated provider store, checkout and artifact directory to the captured environment. */
  constructor(
    private readonly context: EvidencePublicationContext,
    private readonly delivery: DeliveryRecord,
  ) {
    const { root, repositoryId, repository } = context;
    this.provider = new ProviderStore(join(root, 'provider.sqlite'));
    this.git = new DeliveryGit(delivery, repositoryId, repository, join(root, 'publication'));
    this.prs = new SimulatedPullRequests(delivery, this.provider, this.git, context.checks);
    this.releases = new SimulatedReleases(delivery, this.provider, join(root, 'artifacts'));
  }

  /** Routes each operation to the component that owns it without changing effect semantics. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    return this.adapter(effect).apply(effect, signal);
  }

  /** Reconciles against the namespace's own durable record after an interrupted operation. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    signal.throwIfAborted();
    return this.adapter(effect).inspect(effect);
  }

  /** The actual target head in this namespace, which the change record must still match. */
  async gates(signal: AbortSignal): Promise<{ base: string }> {
    signal.throwIfAborted();
    return { base: this.git.targetHead() };
  }

  /** A prior gate may be reused only while its evidence still describes the current change record. */
  reuseCheck(effect: ExternalEffect): boolean {
    return this.prs.currentCheck(effect);
  }

  /** The pushed head, which is also the head the gate must have verified. */
  head(): string {
    const receipt = this.current().receipts.commit;
    if (!receipt) throw new Error('Missing verified delivery commit receipt');
    return String(this.context.effects.effect(receipt).result?.head);
  }

  /** Requires the captured simulated destination and the isolated checkout for this namespace. */
  assertPolicy(
    delivery: DeliveryRecord,
    repositoryId: string,
    policy: CapturedPublicationPolicy,
  ): void {
    if (delivery.environment.mode !== 'simulation')
      throw new Error('Evidence publication requires a simulated delivery environment');
    if (policy.operation.repository !== repositoryId || !policy.operation.targetBranch)
      throw new Error('Evidence publication policy lacks captured destination authority');
  }

  /** Closes the namespace store without touching the supervising host's shared stores. */
  close(): void {
    this.provider.close();
  }

  /** Selects the owner of an operation group; scheduling and verification stay with the route. */
  private adapter(effect: ExternalEffect) {
    if (effect.operation.startsWith('delivery.')) return this.git;
    if (effect.operation.startsWith('pull-request.')) return this.prs;
    return this.releases;
  }

  /** Reads the delivery freshly so intervening milestone state is seen. */
  private current(): DeliveryRecord {
    return this.context.deliveries.get(this.delivery.id);
  }
}
