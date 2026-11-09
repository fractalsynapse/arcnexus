import { join } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { CheckResult } from '../operations/check-result.js';
import type { CapturedPublicationPolicy } from './publication-policy.js';
import { PublicationEffects } from './publication-effects.js';

/**
 * The provider side of publication: everything that differs between a real remote and a captured
 * namespace, and nothing else.
 *
 * `actions` is the operation set this provider offers under the captured policy, which is why the
 * engine can run a verify or release step without a boolean: the route asks the provider what it
 * does rather than branching on where it is running.
 */
export interface PublicationProvider {
  readonly mode: 'live' | 'simulation';

  readonly actions: string[];

  /** Applies one authorized operation and returns its provider receipt. */
  apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>>;

  /** Reconciles an uncertain effect against the provider's own truth. */
  inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation>;

  /** True when a prior gate's observed pass still describes the provider's current state. */
  reuseCheck?(effect: ExternalEffect): boolean;

  /** Observes the current target head; throws when the provider blocks integration. */
  gates(signal: AbortSignal): Promise<{ base: string }>;

  /** The committed delivery head, recovered from its durable receipt and revalidated. */
  head(): string;

  /** Rejects a policy that does not match this provider's captured authority. */
  assertPolicy(
    delivery: DeliveryRecord,
    repositoryId: string,
    policy: CapturedPublicationPolicy,
  ): void;

  /** Releases provider-held resources; the supervising host keeps shared stores open. */
  close(): void;
}

export interface PublicationContext {
  root: string;
  repositoryId: string;
  effects: LifecycleStore;
  deliveries: DeliveryStore;
  policy: CapturedPublicationPolicy;
  checks: (head: string, signal: AbortSignal, independent?: boolean) => Promise<CheckResult>;

  /** Present when a prior interrupted gate is being retried under the same attempt identity. */
  checkAttempt?: string;
}

/**
 * The one publication route: it advances a verified delivery to integrated, in whichever
 * environment the delivery was captured for.
 *
 * Sequence, gates and failure handling are the architecture, so they live here once: commit, then
 * the provider's own verification step when it declares one, push, change record, provider
 * requirements, exact-revision authorization, assembled integration under the shared merge
 * protocol, and a release record when the provider declares that step. Everything provider-shaped
 * is delegated; everything route-shaped is here.
 */
export class Publication {
  private readonly effects: PublicationEffects;

  /** Captures immutable policy and delivery identity before any provider or transport object exists. */
  constructor(
    protected readonly context: PublicationContext,
    protected readonly provider: PublicationProvider,
    protected readonly delivery: DeliveryRecord,
  ) {
    this.delivery = structuredClone(delivery);
    this.context = { ...context, policy: structuredClone(context.policy) };
    this.assertPolicy();
    this.effects = this.execution();
  }

  /** Runs the route, retaining completed milestones and blocking the delivery on failure. */
  async publish(signal: AbortSignal): Promise<DeliveryRecord> {
    try {
      await this.effects.step('commit', 'delivery.commit', signal);
      if (this.declares('delivery.verify')) await this.verify(signal);
      await this.effects.step('push', 'delivery.push', signal);
      await this.effects.step('pull_request', 'pull-request.create', signal);
      if (this.declares('pull-request.check')) await this.gate(signal);
      const merged = await this.merge(signal);
      if (merged.result?.merged !== true) throw new Error('Integration was not verified');
      this.effects.complete('merge', merged.id);
      if (this.declares('release.create'))
        await this.effects.step('release', 'release.create', signal);
      return this.effects.current();
    } catch (error) {
      const current = this.effects.current();
      this.context.deliveries.block(current.id, current.version, String(error));
      throw error;
    }
  }

  /** Forgets held provider state without touching the host's shared stores. */
  close(): void {
    this.provider.close();
  }

  /** Binds the provider into the same durable write-ahead protocol used by every effect. */
  private execution(): PublicationEffects {
    const { environment } = this.delivery;
    return new PublicationEffects(
      this.context.effects,
      this.context.deliveries,
      this.delivery,
      {
        id: this.context.effects.environment(environment.id).providerId,
        mode: this.provider.mode,
        apply: (effect, signal) => this.provider.apply(effect, signal),
        inspect: (effect, signal) => this.provider.inspect(effect, signal),
      },
      this.context.policy.operation.definitionDigest!,
      this.provider.actions,
    );
  }

  /** Confirms the committed delivery passed its independent gate before anything moves. */
  private async verify(signal: AbortSignal): Promise<void> {
    const verification = await this.effects.effect('delivery.verify', signal);
    const evidence = verification.result?.evidence as string[] | undefined;
    if (verification.result?.status !== 'passed' || !evidence?.length)
      throw new Error('Publication checks failed');
  }

  /** Runs a provider's post-change verification and requires the observed pass before gates. */
  private async gate(signal: AbortSignal): Promise<void> {
    if (this.context.checkAttempt) {
      const refreshed = await this.effects.refreshChecks(
        this.context.checkAttempt,
        signal,
        (check) => this.provider.reuseCheck?.(check) ?? false,
      );
      if (refreshed.result?.checks !== 'passed') throw new Error('Publication checks failed');
      return;
    }
    const checked = await this.effects.effect('pull-request.check', signal);
    if (checked.result?.checks !== 'passed') throw new Error('Publication checks failed');
  }

  /** Integrates against the observed target, reusing a prior intent instead of starting a second one. */
  private async merge(
    signal: AbortSignal,
  ): Promise<{ id: string; result?: Record<string, unknown> }> {
    const prior = this.effects.prior('pull-request.merge');
    const targetHead = prior?.input.targetHead ?? (await this.provider.gates(signal)).base;
    this.assertApproval();
    return this.effects.effect('pull-request.merge', signal, { targetHead });
  }

  /** Requires an explicit automatic grant or authorization for this exact immutable candidate. */
  private assertApproval(): void {
    if (
      this.context.policy.operation.automaticMerge !== true &&
      this.effects.current().approval?.candidate !== this.delivery.candidate
    )
      throw new Error('Delivery requires approval for the captured candidate revision');
  }

  /** Keeps publication evidence outside source and separated by environment. */
  protected evidenceRoot(): string {
    return join(this.context.root, 'publication');
  }

  /** True when the provider performs this operation under the captured policy. */
  private declares(operation: string): boolean {
    return this.provider.actions.includes(operation);
  }

  /** Rejects missing, changed or cross-repository publication authority before any provider state. */
  private assertPolicy(): void {
    const policy = this.context.policy.operation;
    if (
      this.delivery.environment.mode !== this.provider.mode ||
      policy.action !== 'delivery.publish' ||
      policy.repository !== this.context.repositoryId ||
      !policy.definitionDigest ||
      policy.targetBranch !== this.delivery.target.branch
    )
      throw new Error('Publication policy does not match captured delivery authority');
  }
}
