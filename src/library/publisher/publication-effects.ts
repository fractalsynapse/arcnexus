import { createHash } from 'node:crypto';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { DeliveryRecord, DeliveryMilestone } from '../coordination-store/delivery-types.js';
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
    signal.throwIfAborted();
    const id = createHash('sha256')
      .update(this.delivery.id + ':' + operation)
      .digest('hex');
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
