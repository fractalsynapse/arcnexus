import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import { ProviderStore, type ProviderResource } from '../coordination-store/provider-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { DeliveryGit } from './delivery-git.js';

export interface SimulationCheckResult {
  status: 'passed' | 'failed';
  evidence: string[];
  artifacts: Array<{ path: string; sha256: string }>;
}

/** Models observable PR/check/review transitions against actual pushed Git delivery heads. */
export class SimulatedPullRequests {
  private readonly id: string;

  /** Binds simulated provider state to a host delivery and an actual declared-check executor. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly store: ProviderStore,
    private readonly git: DeliveryGit,
    private readonly checks: (
      head: string,
      signal: AbortSignal,
      independent?: boolean,
    ) => Promise<SimulationCheckResult>,
  ) {
    this.delivery = structuredClone(delivery);
    if (delivery.environment.mode !== 'simulation') throw new Error('Expected simulation delivery');
    this.id = `${delivery.environment.id}:pr:${delivery.id}`;
  }

  /** Dispatches provider state changes while check execution remains supervised by the host service. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.assert(effect);
    if (effect.operation === 'pull-request.check') return this.check(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.merge(effect, signal);
    return this.store.apply(effect, () => {
      if (effect.operation === 'pull-request.create') return this.create(effect);
      if (effect.operation === 'pull-request.review') return this.review(effect);
      throw new Error('Unsupported simulated PR operation');
    });
  }

  /** Distinguishes an absent pure mutation from an uncertain interrupted host check. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    const observed = this.store.inspect(effect);
    if (effect.operation !== 'pull-request.merge' || observed.status !== 'unknown') return observed;
    const merged = this.git.inspectMerge(effect);
    if (merged.status !== 'completed') return merged;
    return { ...merged, result: this.finishMerge(effect, merged.result) };
  }

  /** Creates a PR only for an actually pushed verified commit, with checks and reviews initially pending. */
  private create(effect: ExternalEffect): Record<string, unknown> {
    const head = this.head(effect);
    const existing = this.store.resources().find((resource) => resource.id === this.id);
    if (existing) {
      if (existing.data.head !== head) throw new Error('Simulated PR head changed');
      return this.receipt(existing);
    }
    const resource: ProviderResource = {
      id: this.id,
      kind: 'pull_request',
      revision: 1,
      data: {
        deliveryId: this.delivery.id,
        environmentId: this.delivery.environment.id,
        runId: this.delivery.runId,
        target: this.delivery.target,
        head,
        state: 'open',
        checks: 'pending',
        review: 'pending',
        simulation: true,
      },
    };
    this.store.create(resource);
    return this.receipt(resource);
  }

  /** Executes real declared checks and binds their observed results to the unchanged pushed head. */
  private async check(
    effect: ExternalEffect,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const prior = this.store.inspect(effect);
    if (prior.status === 'completed') return prior.result;
    if (prior.status !== 'absent') throw new Error('Simulated check requires reconciliation');
    const resource = this.current(effect);
    this.store.start(effect);
    const result = await this.checks(String(resource.data.head), signal);
    signal.throwIfAborted();
    if (!['passed', 'failed'].includes(result.status) || !result.evidence.length)
      throw new Error('Simulated check lacks observed host evidence');
    return this.store.apply(effect, () => {
      this.current(effect);
      const updated = this.store.update(this.id, resource.revision, {
        checks: result.status,
        checkHead: resource.data.head,
        checkEvidence: result.evidence,
        artifacts: result.artifacts,
      });
      return this.receipt(updated);
    });
  }

  /** Rechecks the assembled tree independently before locking provider review and atomically moving the target. */
  private async merge(
    effect: ExternalEffect,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const prior = this.inspect(effect);
    if (prior.status === 'completed') return prior.result;
    if (prior.status !== 'absent') throw new Error('Simulated merge requires reconciliation');
    const resource = this.ready(effect);
    this.store.start(effect);
    const assembled = await this.git.assemble(effect, signal);
    const checked = await this.checks(assembled, signal, true);
    signal.throwIfAborted();
    if (!checked.evidence.length) throw new Error('Assembled merge has no verification evidence');
    if (checked.status !== 'passed') return this.blockMerge(effect, resource, checked);
    this.store.checkpoint(effect, () => {
      this.ready(effect);
      return this.store.update(this.id, resource.revision, {
        mergeInProgress: effect.id,
        mergeHead: assembled,
        mergeChecks: checked,
      });
    });
    return this.finishMerge(effect, await this.git.integrate(effect, assembled, signal));
  }

  /** Records an observed rejection without claiming integration or losing passed engineering evidence. */
  private blockMerge(
    effect: ExternalEffect,
    resource: ProviderResource,
    checked: SimulationCheckResult,
  ) {
    return this.store.apply(effect, () => {
      this.store.update(this.id, resource.revision, { mergeChecks: checked });
      return {
        ...this.receipt(this.store.resource(this.id)),
        merged: false,
        reason: 'Assembled merge failed current verification',
      };
    });
  }

  /** Reconciles provider completion only when the actual target and retained independent checks agree. */
  private finishMerge(effect: ExternalEffect, result: Record<string, unknown>) {
    return this.store.apply(effect, () => {
      const resource = this.store.resource(this.id);
      const checks = resource.data.mergeChecks as SimulationCheckResult | undefined;
      if (
        resource.data.mergeInProgress !== effect.id ||
        resource.data.mergeHead !== result.head ||
        checks?.status !== 'passed' ||
        !checks.evidence.length
      )
        throw new Error('Merge receipt lacks captured independent verification');
      this.store.update(this.id, resource.revision, { state: 'merged', mergeInProgress: null });
      return { ...this.receipt(this.store.resource(this.id)), ...result };
    });
  }

  /** Records explicitly synthetic provider review; this never substitutes for independent engineering acceptance. */
  private review(effect: ExternalEffect): Record<string, unknown> {
    const resource = this.current(effect);
    const decision = effect.input.decision;
    if (!['approved', 'changes_requested'].includes(String(decision)))
      throw new Error('Expected simulated provider review decision');
    const updated = this.store.update(this.id, resource.revision, {
      review: decision,
      reviewHead: resource.data.head,
      reviewSimulation: true,
    });
    return this.receipt(updated);
  }

  /** Confirms the original check, provider evidence and actual pushed revision before reusing a pass. */
  currentCheck(effect: ExternalEffect): boolean {
    this.assert(effect);
    if (effect.operation !== 'pull-request.check' || effect.result?.checks !== 'passed')
      return false;
    const resource = this.store.resource(this.id);
    const observed = this.store.inspect(effect);
    return (
      observed.status === 'completed' &&
      observed.result.head === effect.result.head &&
      resource.data.checks === 'passed' &&
      Array.isArray(resource.data.checkEvidence) &&
      resource.data.checkEvidence.length > 0 &&
      resource.data.checkHead === effect.result.head &&
      this.head(effect) === effect.result.head
    );
  }

  /** Requires current green checks and provider review, independently of local delivery approval. */
  ready(effect: ExternalEffect): ProviderResource {
    const resource = this.current(effect);
    if (
      resource.data.checks !== 'passed' ||
      resource.data.checkHead !== resource.data.head ||
      resource.data.review !== 'approved' ||
      resource.data.reviewHead !== resource.data.head
    )
      throw new Error('Simulated PR requires current passing checks and provider review');
    return resource;
  }

  /** Refuses stale or closed PRs before checks, reviews or merge admission. */
  private current(effect: ExternalEffect): ProviderResource {
    const resource = this.store.resource(this.id);
    if (
      (resource.data.mergeInProgress && resource.data.mergeInProgress !== effect.id) ||
      resource.kind !== 'pull_request' ||
      resource.data.state !== 'open' ||
      resource.data.head !== this.head(effect)
    )
      throw new Error('Simulated PR is closed or its pushed head changed');
    return resource;
  }

  /** Reads actual Git ref evidence rather than accepting a worker-supplied head. */
  private head(effect: ExternalEffect): string {
    const pushed = this.git.inspect({
      ...effect,
      operation: 'delivery.push',
      input: { deliveryId: this.delivery.id },
    });
    if (pushed.status !== 'completed')
      throw new Error('Simulated PR requires an actual verified push');
    return String(pushed.result.head);
  }

  /** Validates complete host intent and prevents cross-environment or target substitution. */
  private assert(effect: ExternalEffect): void {
    const allowed =
      effect.operation === 'pull-request.review'
        ? ['deliveryId', 'decision']
        : effect.operation === 'pull-request.merge'
          ? ['deliveryId', 'targetHead']
          : ['deliveryId'];
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.input.deliveryId !== this.delivery.id ||
      Object.keys(effect.input).some((key) => !allowed.includes(key))
    )
      throw new Error('Simulated PR intent is outside captured delivery authority');
  }

  /** Exposes current lifecycle outcomes with explicit simulation provenance. */
  private receipt(resource: ProviderResource): Record<string, unknown> {
    return {
      id: resource.id,
      revision: resource.revision,
      head: resource.data.head,
      checks: resource.data.checks,
      review: resource.data.review,
      environmentId: this.delivery.environment.id,
      simulation: true,
    };
  }
}
