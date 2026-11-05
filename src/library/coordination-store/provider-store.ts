import { ExecutionDatabase } from './execution-database.js';
import type { ExternalEffect, ExternalObservation } from './lifecycle-types.js';

export interface ProviderResource {
  id: string;
  kind: string;
  revision: number;
  data: Record<string, unknown>;
}

interface ProviderReceipt {
  id: string;
  inputDigest: string;
  result: Record<string, unknown>;
}

/** Stores simulated provider effects atomically outside the host's receipt journal. */
export class ProviderStore {
  private readonly db: ExecutionDatabase;

  private applying = false;

  /** Opens the isolated provider database without sharing a transaction with execution evidence. */
  constructor(path: string, readOnly = false) {
    this.db = new ExecutionDatabase(path, readOnly);
  }

  /** Commits resource changes and provider receipt together, deduplicating concurrent retries. */
  apply(effect: ExternalEffect, change: () => Record<string, unknown>): Record<string, unknown> {
    return this.db.transaction('provider.applied', { id: effect.id }, () => {
      const receipt = this.receipt(effect);
      if (receipt) return receipt.result;
      const result = this.change(change);
      this.db.put('receipt', { id: effect.id, inputDigest: effect.inputDigest, result });
      return result;
    });
  }

  /** Journals asynchronous provider work so an interrupted check cannot be mistaken for an absent request. */
  start(effect: ExternalEffect): void {
    this.db.transaction('provider.started', { id: effect.id }, () => {
      if (this.db.all<{ id: string }>('pending').some((pending) => pending.id === effect.id))
        throw new Error('Provider work requires reconciliation before retry');
      this.db.put('pending', { id: effect.id, inputDigest: effect.inputDigest });
    });
  }

  /** Retains asynchronous provider progress without claiming the external effect has completed. */
  checkpoint(effect: ExternalEffect, change: () => unknown): void {
    this.db.transaction('provider.checkpoint', { id: effect.id }, () => {
      this.receipt(effect);
      if (!this.db.all<{ id: string }>('pending').some((pending) => pending.id === effect.id))
        throw new Error('Provider checkpoint requires started work');
      this.change(change);
    });
  }

  /** Reconciles against durable provider state rather than assuming a failed transport had no effect. */
  inspect(effect: ExternalEffect): ExternalObservation {
    return this.db.snapshot(() => {
      const receipt = this.receipt(effect);
      const evidence = `simulated-provider:${effect.environmentId}:${effect.id}`;
      const pending = this.db
        .all<{ id: string; inputDigest: string }>('pending')
        .find((item) => item.id === effect.id);
      if (pending && pending.inputDigest !== effect.inputDigest)
        throw new Error('Provider idempotency identity conflict');
      if (!receipt && pending)
        return {
          status: 'unknown',
          evidence,
          reason: 'Provider work started without a completed receipt',
        };
      return receipt
        ? { status: 'completed', evidence, result: receipt.result }
        : { status: 'absent', evidence };
    });
  }

  /** Reads a resource; unknown identities fail instead of producing fabricated state. */
  resource(id: string): ProviderResource {
    return this.db.get('resource', id);
  }

  /** Lists durable resources for simulation inspection. */
  resources(): ProviderResource[] {
    return this.db.all('resource');
  }

  /** Creates a resource inside apply's transaction and rejects collisions. */
  create(resource: ProviderResource): void {
    if (!this.applying) throw new Error('Provider mutation requires an effect transaction');
    if (this.resources().some((entry) => entry.id === resource.id))
      throw new Error('Provider resource already exists');
    this.db.put('resource', resource);
  }

  /** Updates exactly the observed revision inside apply's transaction. */
  update(id: string, revision: number, data: Record<string, unknown>): ProviderResource {
    if (!this.applying) throw new Error('Provider mutation requires an effect transaction');
    const resource = this.resource(id);
    if (resource.revision !== revision) throw new Error('Stale provider resource revision');
    const next = { ...resource, revision: revision + 1, data: { ...resource.data, ...data } };
    this.db.put('resource', next);
    return next;
  }

  /** Limits resource mutation to the synchronous atomic effect application. */
  private change<T>(action: () => T): T {
    this.applying = true;
    try {
      return action();
    } finally {
      this.applying = false;
    }
  }

  /** Releases provider state after use. */
  close(): void {
    this.db.close();
  }

  /** Rejects attempts to reuse the same provider key for a different external request. */
  private receipt(effect: ExternalEffect): ProviderReceipt | undefined {
    const pending = this.db
      .all<{ id: string; inputDigest: string }>('pending')
      .find((entry) => entry.id === effect.id);
    if (pending && pending.inputDigest !== effect.inputDigest)
      throw new Error('Provider idempotency identity conflict');
    const receipt = this.db.all<ProviderReceipt>('receipt').find((r) => r.id === effect.id);
    if (receipt && receipt.inputDigest !== effect.inputDigest)
      throw new Error('Provider idempotency identity conflict');
    return receipt;
  }
}
