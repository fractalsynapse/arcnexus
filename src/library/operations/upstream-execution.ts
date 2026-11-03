import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type {
  ExternalEffect,
  ExternalIntent,
  ExternalObservation,
  LifecycleEnvironment,
} from '../coordination-store/lifecycle-types.js';

export interface UpstreamProvider {
  readonly id: string;
  readonly mode: LifecycleEnvironment['mode'];
  apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>>;
  inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation>;
}

export interface UpstreamAuthority {
  environmentId: string;
  runId: string;
  assignmentId?: string;
  authorityDigest: string;
  grants: Array<{ operation: string; target: string; definitionDigest: string }>;
}

/** Runs authorized upstream effects through one write-ahead and reconciliation protocol. */
export class UpstreamExecution {
  private readonly authority: UpstreamAuthority;

  /** Captures host-supplied identity and grants; workers never supply their own assignment binding. */
  constructor(
    private readonly store: LifecycleStore,
    private readonly provider: UpstreamProvider,
    authority: UpstreamAuthority,
  ) {
    this.authority = structuredClone(authority);
    this.validateEnvironment();
  }

  /** Resolves a permitted intent, reuses receipts and refuses to blindly replay uncertain effects. */
  async execute(
    id: string,
    operation: string,
    target: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ExternalEffect> {
    signal.throwIfAborted();
    this.validateEnvironment();
    let effect = this.store.prepare(this.intent(id, operation, target, input));
    if (effect.status !== 'prepared') return effect;
    signal.throwIfAborted();
    effect = this.store.begin(effect.id);
    const result = await this.provider.apply(effect, signal);
    return this.store.complete(effect.id, effect.attempt, result);
  }

  /** Reconciles only after the supervising host establishes that the prior invocation has ended. */
  async recover(id: string, signal: AbortSignal): Promise<ExternalEffect> {
    signal.throwIfAborted();
    this.validateEnvironment();
    const effect = this.store.effect(id);
    if (
      effect.environmentId !== this.authority.environmentId ||
      effect.runId !== this.authority.runId ||
      effect.assignmentId !== this.authority.assignmentId
    )
      throw new Error('Effect is outside the active assignment');
    const captured = this.intent(id, effect.operation, effect.target, effect.input);
    if (captured.definitionDigest !== effect.definitionDigest)
      throw new Error('Effect operation authority changed');
    if (effect.status !== 'uncertain') return effect;
    const observation = await this.provider.inspect(effect, signal);
    signal.throwIfAborted();
    return this.store.reconcile(effect.id, effect.attempt, observation);
  }

  /** Derives operation identity from an exact host grant, never from worker input. */
  private intent(
    id: string,
    operation: string,
    target: string,
    input: Record<string, unknown>,
  ): ExternalIntent {
    const grant = this.authority.grants.find(
      (g) => g.operation === operation && g.target === target,
    );
    if (!grant) throw new Error('Upstream operation or destination is not authorized');
    return {
      id,
      environmentId: this.authority.environmentId,
      runId: this.authority.runId,
      assignmentId: this.authority.assignmentId,
      operation,
      target,
      definitionDigest: grant.definitionDigest,
      input: structuredClone(input),
    };
  }

  /** Prevents a simulation authority from being routed through a live provider, including recovery. */
  private validateEnvironment(): void {
    const environment = this.store.environment(this.authority.environmentId);
    if (
      environment.providerId !== this.provider.id ||
      environment.mode !== this.provider.mode ||
      environment.authorityDigest !== this.authority.authorityDigest
    )
      throw new Error('Upstream provider does not match captured environment authority');
  }
}
