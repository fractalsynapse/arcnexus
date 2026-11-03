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

  /** Reconciles against durable provider state rather than assuming a failed transport had no effect. */
  inspect(effect: ExternalEffect): ExternalObservation {
    return this.db.snapshot(() => {
      const receipt = this.receipt(effect);
      const evidence = `simulated-provider:${effect.environmentId}:${effect.id}`;
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
  private change(action: () => Record<string, unknown>): Record<string, unknown> {
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
    const receipt = this.db.all<ProviderReceipt>('receipt').find((r) => r.id === effect.id);
    if (receipt && receipt.inputDigest !== effect.inputDigest)
      throw new Error('Provider idempotency identity conflict');
    return receipt;
  }
}
