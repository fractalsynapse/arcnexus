import { createHash } from 'node:crypto';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { DeliveryRecord, DeliveryMilestone } from '../coordination-store/delivery-types.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import { UpstreamExecution, type UpstreamProvider } from '../operations/upstream-execution.js';

/** Shares publication identities, write-ahead recovery and milestone updates across provider environments. */
export class PublicationEffects {
  private readonly executor: UpstreamExecution;

  /** Captures a fixed provider and operation grant without accepting worker-supplied destinations. */
  constructor(
    private readonly effects: LifecycleStore,
    private readonly deliveries: DeliveryStore,
    private readonly delivery: DeliveryRecord,
    provider: UpstreamProvider,
    definitionDigest: string,
    actions: string[],
  ) {
    this.delivery = structuredClone(delivery);
    this.executor = new UpstreamExecution(effects, provider, {
      environmentId: delivery.environment.id,
      runId: delivery.runId,
      authorityDigest: delivery.authorityDigest,
      grants: actions.map((operation) => ({
        operation,
        target: delivery.target.repository,
        definitionDigest,
      })),
    });
  }

  /** Reuses immutable intent and reconciles uncertain results before permitting any new invocation. */
  async effect(operation: string, signal: AbortSignal, input: Record<string, unknown> = {}) {
    return this.invoke(this.identity(operation), operation, signal, input);
  }

  /** Reconciles unfinished observations before a host-authorized fresh simulated check attempt. */
  async refreshChecks(
    attempt: string,
    signal: AbortSignal,
    reusable: (effect: ExternalEffect) => boolean,
  ) {
    if (this.delivery.environment.mode !== 'simulation' || !attempt)
      throw new Error('Fresh simulated checks require a retained host attempt identity');
    const operation = 'pull-request.check';
    const checks = this.effects
      .effects()
      .filter(
        (effect) =>
          effect.operation === operation &&
          effect.environmentId === this.delivery.environment.id &&
          effect.runId === this.delivery.runId &&
          effect.input.deliveryId === this.delivery.id,
      );
    for (const effect of checks.filter((entry) => entry.status !== 'completed'))
      await this.invoke(effect.id, operation, signal, effect.input);
    const current = checks.find((effect) => effect.status === 'completed' && reusable(effect));
    if (current) return current;
    const id = createHash('sha256')
      .update(this.identity(operation) + ':' + attempt)
      .digest('hex');
    return this.invoke(id, operation, signal, {});
  }

  /** Preserves each immutable effect intent and requires observed completion before returning a receipt. */
  private async invoke(
    id: string,
    operation: string,
    signal: AbortSignal,
    input: Record<string, unknown>,
  ) {
    signal.throwIfAborted();
    const prior = this.effects.effects().find((effect) => effect.id === id);
    let effect = prior?.status === 'uncertain' ? await this.executor.recover(id, signal) : prior;
    if (!effect || effect.status === 'prepared')
      effect = await this.executor.execute(
        id,
        operation,
        this.delivery.target.repository,
        prior?.input ?? { deliveryId: this.delivery.id, ...input },
        signal,
      );
    if (effect.status !== 'completed')
      throw new Error(`Publication ${operation} requires reconciliation: ${effect.status}`);
    return effect;
  }

  /** Exposes retained intent so recovery does not require a new provider readiness decision. */
  prior(operation: string) {
    return this.effects.effects().find((effect) => effect.id === this.identity(operation));
  }

  /** Derives one stable identity per immutable delivery operation in both environments. */
  private identity(operation: string): string {
    return createHash('sha256')
      .update(this.delivery.id + ':' + operation)
      .digest('hex');
  }

  /** Persists a milestone only after its exact provider effect has a completed receipt. */
  async step(milestone: DeliveryMilestone, operation: string, signal: AbortSignal) {
    const effect = await this.effect(operation, signal);
    this.complete(milestone, effect.id);
    return effect;
  }

  /** Makes receipt-to-milestone recovery idempotent after host loss. */
  complete(milestone: DeliveryMilestone, effectId: string): void {
    const current = this.current();
    this.deliveries.complete(current.id, current.version, milestone, effectId);
  }

  /** Reads current authorization rather than retaining a stale local approval snapshot. */
  current(): DeliveryRecord {
    return this.deliveries.get(this.delivery.id);
  }
}
