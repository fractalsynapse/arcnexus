import { createHash } from 'node:crypto';
import { ExecutionDatabase } from './execution-database.js';
import type {
  ExternalEffect,
  ExternalIntent,
  ExternalObservation,
  LifecycleEnvironment,
} from './lifecycle-types.js';

/** Retains immutable environments and write-ahead upstream intents independently of provider state. */
export class LifecycleStore {
  private readonly db: ExecutionDatabase;

  /** Opens host-owned lifecycle evidence; read-only inspection never creates or recovers state. */
  constructor(path: string, readOnly = false) {
    this.db = new ExecutionDatabase(path, readOnly);
  }

  /** Registers an immutable environment; retries must preserve every captured authority field. */
  register(environment: LifecycleEnvironment): LifecycleEnvironment {
    this.nonempty(Object.values(environment));
    if (!['live', 'simulation'].includes(environment.mode)) throw new Error('Invalid mode');
    return this.db.transaction('environment.registered', { id: environment.id }, () => {
      const prior = this.environments().find((entry) => entry.id === environment.id);
      if (prior && this.digest(prior) !== this.digest(environment))
        throw new Error('Captured lifecycle environment cannot change');
      if (!prior) this.db.put('environment', environment);
      return this.environment(environment.id);
    });
  }

  /** Reads the captured environment rather than trusting provider or worker claims about mode. */
  environment(id: string): LifecycleEnvironment {
    return this.db.get('environment', id);
  }

  /** Lists retained environments without starting execution. */
  environments(): LifecycleEnvironment[] {
    return this.db.all('environment');
  }

  /** Captures complete intent before effects; identical retries reuse durable identity. */
  prepare(intent: ExternalIntent): ExternalEffect {
    this.nonempty([
      intent.id,
      intent.environmentId,
      intent.runId,
      intent.operation,
      intent.target,
      intent.definitionDigest,
    ]);
    const inputDigest = this.digest(intent);
    return this.db.transaction('effect.prepared', { id: intent.id }, () => {
      this.environment(intent.environmentId);
      const prior = this.effects().find((entry) => entry.id === intent.id);
      if (prior && prior.inputDigest !== inputDigest)
        throw new Error('External effect identity reused with different intent');
      if (!prior) this.db.put('effect', { ...intent, inputDigest, status: 'prepared', attempt: 0 });
      return this.effect(intent.id);
    });
  }

  /** Claims one attempt before provider access; an uncertain operation cannot execute again. */
  begin(id: string): ExternalEffect {
    return this.db.transaction('effect.started', { id }, () => {
      const effect = this.effect(id);
      if (effect.status !== 'prepared') throw new Error('Effect requires reconciliation');
      this.db.put('effect', { ...effect, status: 'uncertain', attempt: effect.attempt + 1 });
      return this.effect(id);
    });
  }

  /** Persists a provider receipt only for the current attempt, rejecting stale completion. */
  complete(id: string, attempt: number, result: Record<string, unknown>): ExternalEffect {
    return this.db.transaction('effect.completed', { id, attempt }, () => {
      const effect = this.current(id, attempt);
      this.db.put('effect', { ...effect, status: 'completed', result });
      return this.effect(id);
    });
  }

  /** Reconciles uncertain effects without equating transport failure with absence. */
  reconcile(id: string, attempt: number, observation: ExternalObservation): ExternalEffect {
    this.nonempty([observation.evidence]);
    return this.db.transaction('effect.reconciled', { id, attempt, observation }, () => {
      const effect = this.current(id, attempt);
      if (observation.status === 'completed')
        this.db.put('effect', { ...effect, status: 'completed', result: observation.result });
      else if (observation.status === 'rejected')
        this.db.put('effect', { ...effect, status: 'rejected', reason: observation.reason });
      else if (observation.status === 'absent')
        this.db.put('effect', { ...effect, status: 'prepared' });
      return this.effect(id);
    });
  }

  /** Reads a retained intent and its latest outcome. */
  effect(id: string): ExternalEffect {
    return this.db.get('effect', id);
  }

  /** Lists ordered effect evidence for resource views and recovery. */
  effects(): ExternalEffect[] {
    return this.db.all('effect');
  }

  /** Exposes the append-only transition history using the shared exclusive cursor. */
  events(after = 0) {
    return this.db.events(after);
  }

  /** Releases the connection after host use or read-only inspection. */
  close(): void {
    this.db.close();
  }

  /** Rejects receipts from superseded attempts or already settled effects. */
  private current(id: string, attempt: number): ExternalEffect {
    const effect = this.effect(id);
    if (effect.status !== 'uncertain' || effect.attempt !== attempt)
      throw new Error('Stale external effect attempt');
    return effect;
  }

  /** Validates required identities before writing evidence. */
  private nonempty(values: string[]): void {
    if (values.some((value) => typeof value !== 'string' || !value.trim() || value.includes('\0')))
      throw new Error('External identity and evidence must be nonempty');
  }

  /** Canonicalizes JSON object keys so property insertion order cannot change retry identity. */
  private digest(value: unknown): string {
    const canonical = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(canonical);
      if (entry && typeof entry === 'object')
        return Object.fromEntries(
          Object.entries(entry)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, canonical(child)]),
        );
      return entry;
    };
    return createHash('sha256')
      .update(JSON.stringify(canonical(value)))
      .digest('hex');
  }
}
