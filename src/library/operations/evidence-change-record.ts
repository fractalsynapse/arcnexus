import { publicationContent } from './repository-documents.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { CheckResult } from './check-result.js';
import { integrateAssembled, type MergeAdapter } from './merge-protocol.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { DeliveryGit } from './delivery-git.js';

/** The state a namespace reached, read back from the operations that produced it. */
export interface ChangeState {
  pullRequestId: string;
  head: string;
  state: string;
  checks?: string;
  checkHead?: string;
  checkEvidence?: string[];
  reviewerEvidence?: string[];
  merged?: boolean;
  mergeHead?: string;
}

/**
 * The change record for a namespace with no remote: what was opened, what the gate observed,
 * whether the target moved.
 *
 * There is no second ledger here. Every field is read back from the durable effect that produced
 * it, so the record cannot disagree with the run's own journal, and an interrupted merge is
 * reconciled against the actual Git ref rather than against a stored claim about it. Creating a
 * record or running its gate is a local computation with no external side effect, so an uncertain
 * one is safely absent; only the merge has an outside world to ask.
 */
export class EvidenceChangeRecord {
  private readonly id: string;

  /** Binds the record to one captured delivery, its isolated Git and the host's effect journal. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly git: DeliveryGit,
    private readonly effects: LifecycleStore,
    private readonly checks: (
      head: string,
      signal: AbortSignal,
      independent?: boolean,
    ) => Promise<CheckResult>,
  ) {
    this.delivery = structuredClone(delivery);
    if (delivery.environment.mode !== 'simulation') throw new Error('Expected simulation delivery');
    this.id = `${delivery.environment.id}:pr:${delivery.id}`;
  }

  /** Applies one operation, running real checks for the gate and the shared protocol for the merge. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.assert(effect);
    if (effect.operation === 'pull-request.create') return this.create(effect);
    if (effect.operation === 'pull-request.check') return this.check(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.merge(effect, signal);
    throw new Error('Unsupported change-record operation: ' + effect.operation);
  }

  /** Only the merge has an outside world; every other local operation reconciles as absent. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    if (effect.operation !== 'pull-request.merge')
      return { status: 'absent', evidence: 'local-computation:' + effect.operation };
    return this.git.inspectMerge(effect);
  }

  /** The recorded state, reduced from the operations this delivery already completed. */
  state(): ChangeState {
    const record: Partial<ChangeState> = { pullRequestId: this.id, state: 'open' };
    for (const effect of this.journal()) {
      if (effect.operation === 'pull-request.create')
        Object.assign(record, this.data(effect.result));
      if (effect.operation === 'pull-request.check')
        Object.assign(record, this.data(effect.result));
      if (effect.operation === 'pull-request.merge' && effect.result?.merged === true)
        Object.assign(record, { merged: true, state: 'merged', mergeHead: effect.result.head });
    }
    if (!record.head) throw new Error('Change record requires a recorded opened change');
    return record as ChangeState;
  }

  /** A prior gate pass may be reused only while it still describes the current pushed head. */
  reuseCheck(effect: ExternalEffect): boolean {
    this.assert(effect);
    if (effect.operation !== 'pull-request.check' || effect.result?.checks !== 'passed')
      return false;
    const current = this.state();
    return (
      current.checks === 'passed' &&
      current.checkHead === effect.result.head &&
      current.head === effect.result.head &&
      (current.checkEvidence?.length ?? 0) > 0 &&
      (current.reviewerEvidence?.length ?? 0) > 0 &&
      this.pushedHead() === effect.result.head
    );
  }

  /** Requires an observed pass on the current head backed by independent reviewer coverage. */
  assertReady(): ChangeState {
    const current = this.state();
    if (
      current.checks !== 'passed' ||
      current.checkHead !== current.head ||
      !current.reviewerEvidence?.length
    )
      throw new Error(
        'Simulated PR requires current passing checks with independent reviewer coverage',
      );
    return current;
  }

  /** Opens a change only for a head that was actually pushed, refusing a changed head. */
  private create(effect: ExternalEffect): Record<string, unknown> {
    const head = this.pushedHead();
    const opened = this.journal().find((item) => item.operation === 'pull-request.create');
    if (opened) {
      if (String(opened.result?.head) !== head) throw new Error('Simulated PR head changed');
      return { ...this.data(opened.result), ...publicationContent(effect.input) };
    }
    return {
      pullRequestId: this.id,
      head,
      state: 'open',
      checks: 'pending',
      simulation: true,
      ...publicationContent(effect.input),
    };
  }

  /** Runs the declared checks for real and binds what they observed to the unchanged head. */
  private async check(
    effect: ExternalEffect,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const head = this.state().head;
    const result = await this.checks(head, signal, true);
    signal.throwIfAborted();
    if (!['passed', 'failed'].includes(result.status) || !result.evidence.length)
      throw new Error('Simulated check lacks observed host evidence');
    return {
      pullRequestId: this.id,
      head,
      checks: result.status,
      checkHead: head,
      checkEvidence: result.evidence,
      reviewerEvidence: result.evidence.slice(1),
      artifacts: result.artifacts,
    };
  }

  /** Integrates the assembled tree under the shared protocol, with Git as the only merge truth. */
  private async merge(
    effect: ExternalEffect,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const prior = this.inspect(effect);
    if (prior.status === 'completed') return prior.result;
    if (prior.status !== 'absent') throw new Error('Simulated merge requires reconciliation');
    const merged = await integrateAssembled(
      this.mergeAdapter(effect),
      effect,
      this.checks,
      () => undefined,
      signal,
    );
    return { pullRequestId: this.id, ...merged };
  }

  /** The protocol needs no journaling hooks here: effects and the actual ref already record it. */
  private mergeAdapter(effect: ExternalEffect): MergeAdapter {
    return {
      gates: async () => {
        this.assertReady();
        return { base: this.git.targetHead() };
      },
      assemble: (item, signal) => this.git.assemble(item, signal),
      integrate: async (item, assembled, signal) => this.git.integrate(item, assembled, signal),
      refused: (_item, _assembled, verification) => ({
        merged: false,
        reason: 'Assembled merge failed current verification',
        verification,
      }),
    };
  }

  private journal(): ExternalEffect[] {
    return this.effects
      .effects()
      .filter(
        (effect) =>
          effect.status === 'completed' &&
          String(effect.input.deliveryId ?? '') === this.delivery.id &&
          effect.operation.startsWith('pull-request.'),
      );
  }

  private data(result?: Record<string, unknown>): Partial<ChangeState> {
    return (result ?? {}) as Partial<ChangeState>;
  }

  /** The head actually pushed for this delivery — the only thing a change may open against. */
  private pushedHead(): string {
    const pushed = this.effects
      .effects()
      .find(
        (effect) =>
          effect.status === 'completed' &&
          effect.operation === 'delivery.push' &&
          String(effect.input.deliveryId ?? '') === this.delivery.id,
      );
    if (!pushed?.result?.head) throw new Error('Change record requires an actual pushed head');
    if (this.recorded().merged) throw new Error('Simulated PR is already merged');
    return String(pushed.result.head);
  }

  private recorded(): Partial<ChangeState> {
    try {
      return this.state();
    } catch {
      return {};
    }
  }

  /** Validates complete host intent and prevents cross-environment or target substitution. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.input.deliveryId !== this.delivery.id
    )
      throw new Error('Simulated PR operation differs from delivery authority');
  }
}
