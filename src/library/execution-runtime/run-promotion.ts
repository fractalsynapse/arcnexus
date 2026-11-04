import { join } from 'node:path';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import { Publisher, PublicationPolicy, DeliveryResources } from '../publisher/publisher.js';
import { PromotionAssembly } from '../operations/promotion-assembly.js';
import { RunCollaboration } from './run-collaboration.js';
import type { RunEnvironments } from './run-environments.js';
import { RunPublication } from './run-publication.js';
import { runDestination } from './run-destination.js';

/** Advances promotion through the existing repository host without creating simulated live assignments. */
export class RunPromotion {
  /** Retains sole-host execution and immutable current target authority. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly execution: ExecutionStore,
    private readonly environments: RunEnvironments,
  ) {}

  /** Validates original evidence and current destination before a host creates promotion work. */
  source(id: string, expectedRevision?: string): DeliveryRecord {
    const source = new DeliveryResources(this.root).get(id);
    if (expectedRevision !== undefined && source.revision !== expectedRevision)
      throw new Error('Stale simulation delivery revision');
    if (
      source.environment.mode !== 'simulation' ||
      source.projectId !== this.context.key ||
      source.packageId !== this.context.packageId
    )
      throw new Error('Promotion requires a simulation delivery for this project and package');
    if (!new PublicationPolicy().resolve(this.context))
      throw new Error('Promotion requires current publication authority');
    runDestination(this.context, 'live');
    const store = this.deliveries();
    try {
      new Publisher(this.root, store).resolveRetained(
        source,
        this.execution.run(source.runId),
        this.assignments(source),
      );
      return source;
    } finally {
      store.close();
    }
  }

  /** Queues a distinct real task only after immutable source proof and destination policy are valid. */
  request(
    id: string,
    expectedRevision: string | undefined,
    submit: (prompt: string) => ExecutionRun,
  ) {
    const source = this.source(id, expectedRevision);
    const prior = this.execution
      .runs()
      .find(
        (run) =>
          run.data.promotionSource === id &&
          run.data.executionIdentity === executionIdentity(this.context),
      );
    if (prior) return { accepted: true, runId: prior.id, promotedFrom: source.id };
    const original = this.execution.run(source.runId);
    const run = submit(original.objective);
    this.execution.updateRun(run.id, run.status, {
      promotionSource: source.id,
      promotionStage: 'queued',
      promotionSourceRun: source.runId,
      publicationPolicy: new PublicationPolicy().resolve(this.context),
    });
    return { accepted: true, runId: run.id, promotedFrom: source.id };
  }

  /** Performs one checkpoint stage; interrupted verification cannot be silently replayed. */
  async advance(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    if (run.data.promotionStage === 'verified') {
      if (run.data.pendingPublication)
        await new RunPublication(this.root, this.context, this.execution).advance(
          run,
          this.environments,
          signal,
        );
      if (!signal.aborted && this.execution.run(run.id).status === 'running')
        this.execution.updateRun(run.id, 'completed');
      return;
    }
    const source = this.source(String(run.data.promotionSource));
    if (run.environment?.mode !== 'live') throw new Error('Promotion requires a live run');
    if (run.data.promotionStage === 'queued') {
      await this.tracking(run, signal);
      await this.assemble(run, source, signal);
    } else if (run.data.promotionStage === 'assembled') {
      this.execution.updateRun(run.id, this.execution.run(run.id).status, {
        promotionStage: 'verifying',
      });
      await this.verify(run, source, signal);
    } else throw new Error('Promotion checkpoint requires attention: ' + run.data.promotionStage);
  }

  /** Creates real goal tracking through the same idempotent host collaboration service. */
  private async tracking(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const collaboration = new RunCollaboration(
      this.context,
      this.execution,
      this.environments,
      run,
      signal,
    );
    try {
      await collaboration.tracking();
    } finally {
      collaboration.close();
    }
  }

  /** Imports only attributed changes and reconciles completed pins before any repeated local mutation. */
  private async assemble(run: ExecutionRun, source: DeliveryRecord, signal: AbortSignal) {
    const store = this.deliveries();
    try {
      const record = new Publisher(this.root, store).resolveRetained(
        source,
        this.execution.run(source.runId),
        this.assignments(source),
      );
      const assembly = new PromotionAssembly(
        source,
        record.source,
        this.context.source,
        join(this.environments.directory, run.environment!.id, 'promotion', run.id),
      );
      const head = await this.assemblyEffect(run, source, assembly, signal);
      this.execution.updateRun(run.id, this.execution.run(run.id).status, {
        promotionStage: 'assembled',
        promotionHead: head,
      });
    } finally {
      store.close();
    }
  }

  /** Journals the exact current target and refuses to retry partial or uncertain Git effects. */
  private async assemblyEffect(
    run: ExecutionRun,
    source: DeliveryRecord,
    assembly: PromotionAssembly,
    signal: AbortSignal,
  ): Promise<string> {
    const effects = this.environments.effects;
    let effect = effects.prepare({
      id: run.id + ':promotion',
      environmentId: run.environment!.id,
      runId: run.id,
      operation: 'delivery.promote',
      target: runDestination(this.context, 'live'),
      definitionDigest: new PublicationPolicy().resolve(this.context)!.operation.definitionDigest!,
      input: { deliveryId: source.id, targetHead: this.context.base },
    });
    effect = this.reconcile(effect, assembly);
    if (effect.status === 'prepared') {
      effect = effects.begin(effect.id);
      const head = await assembly.assemble(effect, signal);
      effect = effects.complete(effect.id, effect.attempt, { head });
    }
    return this.completedHead(effect, assembly);
  }

  /** Validates the durable receipt against actual pinned Git objects before advancing readiness. */
  private completedHead(effect: ExternalEffect, assembly: PromotionAssembly): string {
    const head = effect.result?.head;
    if (
      effect.status !== 'completed' ||
      typeof head !== 'string' ||
      head !== assembly.retained(effect)
    )
      throw new Error('Promotion receipt differs from retained assembly');
    return head;
  }

  /** Accepts an uncertain assembly only when its complete immutable pin is present and validated. */
  private reconcile(effect: ExternalEffect, assembly: PromotionAssembly): ExternalEffect {
    if (effect.status !== 'uncertain') return effect;
    const head = assembly.retained(effect);
    if (!head) throw new Error('Promotion assembly is uncertain; inspect retained Git evidence');
    return this.environments.effects.reconcile(effect.id, effect.attempt, {
      status: 'completed',
      evidence: 'Validated immutable promotion pin',
      result: { head },
    });
  }

  /** Captures new live delivery only after fresh target checks, independent review and director assessment. */
  private async verify(run: ExecutionRun, source: DeliveryRecord, signal: AbortSignal) {
    const store = this.deliveries();
    try {
      const result = await new Publisher(this.root, store).promote(
        {
          context: this.context,
          run,
          source,
          sourceRun: this.execution.run(source.runId),
          assignments: this.assignments(source),
          head: String(run.data.promotionHead),
          target: {
            repository: runDestination(this.context, 'live'),
            branch: new PublicationPolicy().resolve(this.context)!.operation.targetBranch,
          },
        },
        signal,
      );
      this.execution.promotion(run.id, result.delivery, result);
    } finally {
      store.close();
    }
  }

  /** Selects only immutable source attribution; no live assignment completion is fabricated. */
  private assignments(source: DeliveryRecord) {
    return source.assignmentIds.map((id) => this.execution.assignment(id));
  }

  /** Opens the current project's delivery ledger without changing historical simulation records. */
  private deliveries(): DeliveryStore {
    return new DeliveryStore(join(this.root, 'projects', this.context.key, 'deliveries.sqlite'));
  }
}
