import { githubHostCredential } from '../operations/github-upstream.js';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import {
  PublicationPolicy,
  Publisher,
  DeliveryResources,
  DeliveryChecks,
  SimulationPublication,
  LivePublication,
  DevelopmentDeliveries,
  type CapturedPublicationPolicy,
} from '../publisher/publisher.js';
import { git } from '../operations/process.js';
import type { RecordData } from '../workspace/state.js';
import type { RunEnvironments } from './run-environments.js';
import { runDestination } from './run-destination.js';

/** Connects verified task/workday outcomes to durable Publisher input without changing run mode or authority. */
export class RunPublication {
  /** Retains the same repository host and transactional engineering store that accepted the candidate. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly execution: ExecutionStore,
  ) {}

  /** Captures each changed candidate once; evidence-only work remains inspectable without inventing a Git delivery. */
  capture(run: ExecutionRun): void {
    const policy = new PublicationPolicy().resolve(this.context);
    if (!policy || !run.environment || !run.data.candidateRecord) return;
    const candidate = run.data.candidateRecord as RecordData;
    if (
      run.data.integratedRevision === run.data.candidateRevision &&
      run.data.integratedRecordId === candidate.id
    )
      return;
    if (this.inherited(run, candidate)) return;
    const changed = git(
      candidate.source,
      'diff',
      '--name-only',
      String(run.data.authorityBase),
      String(run.data.candidateRevision),
      '--',
    ).trim();
    if (!changed) return;
    const store = new DeliveryStore(
      join(this.root, 'projects', this.context.key, 'deliveries.sqlite'),
    );
    try {
      this.retain(run, policy, store);
    } finally {
      store.close();
    }
  }

  /** Leaves a verified handoff attributed to its original run instead of publishing it twice. */
  private inherited(run: ExecutionRun, candidate: RecordData): boolean {
    if (candidate.executionRunId === run.id) return false;
    const source = this.execution.run(String(candidate.executionRunId));
    const retained = source.data.candidateRecord as RecordData | undefined;
    if (
      !retained ||
      retained.id !== candidate.id ||
      candidate.status !== 'completed' ||
      retained.status !== 'completed' ||
      source.data.candidateRevision !== run.data.candidateRevision ||
      source.data.executionIdentity !== run.data.executionIdentity ||
      JSON.stringify(source.environment) !== JSON.stringify(run.environment) ||
      JSON.stringify(candidate.executionEnvironment) !== JSON.stringify(run.environment)
    )
      throw new Error('Inherited publication candidate does not match its verified source run');
    return true;
  }

  /** Persists explicit publication intent for sequential dispatch after the current activation checkpoint. */
  request(id: string, expectedRevision?: string) {
    const delivery = new DeliveryResources(this.root).get(id);
    if (expectedRevision !== undefined && delivery.revision !== expectedRevision)
      throw new Error('Stale delivery revision');
    if (delivery.projectId !== this.context.key) throw new Error('Foreign delivery project');
    const run = this.execution.run(delivery.runId);
    if (
      run.data.executionIdentity !== delivery.authorityDigest ||
      delivery.authorityDigest !== executionIdentity(this.context)
    )
      throw new Error('Delivery authority differs from retained run');
    if (run.data.pendingPublication && run.data.pendingPublication !== id)
      throw new Error('This run already has a queued publication');
    if (delivery.publication !== 'released' && !run.data.pendingPublication)
      this.execution.updateRun(run.id, run.status, {
        pendingPublication: id,
        dependencyCleanup: null,
        publicationCheckAttempt: randomUUID(),
      });
    return { accepted: true, deliveryId: id, runId: run.id };
  }

  /** Advances isolated publication without turning a delivery blocker into failed engineering work. */
  async advance(
    run: ExecutionRun,
    environments: RunEnvironments,
    signal: AbortSignal,
  ): Promise<void> {
    if (!run.data.pendingPublication) this.capture(run);
    const retained = this.execution.run(run.id);
    if (!(retained.data.pendingPublication || retained.data.deliveryId) || !retained.environment)
      return;
    const store = new DeliveryStore(
      join(this.root, 'projects', this.context.key, 'deliveries.sqlite'),
    );
    try {
      await this.publish(retained, environments, store, signal);
      this.integrated(retained, environments, store);
    } catch (error) {
      if (signal.aborted) throw error;
      this.execution.updateRun(run.id, this.execution.run(run.id).status, {
        publicationBlocker: String(error),
      });
    } finally {
      store.close();
      if (run.data.pendingPublication)
        this.execution.updateRun(run.id, this.execution.run(run.id).status, {
          pendingPublication: null,
        });
    }
  }

  /** Makes the verified staging merge the next engineering baseline while retaining original delivery attribution. */
  private integrated(run: ExecutionRun, environments: RunEnvironments, store: DeliveryStore): void {
    const delivery = store.get(String(run.data.pendingPublication ?? run.data.deliveryId));
    const current = this.execution.run(run.id);
    if (delivery.integration !== 'merged' || current.data.candidateRevision !== delivery.candidate)
      return;
    const effect = environments.effects.effect(delivery.receipts.merge!);
    const head = effect.result?.head;
    if (
      effect.status !== 'completed' ||
      effect.result?.merged !== true ||
      typeof head !== 'string' ||
      !/^[a-f0-9]{40,64}$/.test(head)
    )
      throw new Error('Verified staging merge lacks a completed head receipt');
    this.execution.updateRun(run.id, current.status, {
      candidateRevision: head,
      integratedDelivery: delivery.id,
      integratedRevision: head,
      integratedRecordId: delivery.candidateRecordId,
    });
  }

  /** Uses frozen isolated repositories and actual check/verifier services for the provider workflow. */
  private async publish(
    run: ExecutionRun,
    environments: RunEnvironments,
    store: DeliveryStore,
    signal: AbortSignal,
  ) {
    const delivery = store.get(String(run.data.pendingPublication ?? run.data.deliveryId));
    if (delivery.publication === 'released' || (delivery.blocker && !run.data.pendingPublication))
      return;
    if (delivery.developments?.length) {
      new Publisher(this.root, store).resolveRetained(
        delivery,
        run,
        delivery.assignmentIds.map((id) => this.execution.assignment(id)),
      );
      await new DevelopmentDeliveries(this.root).publish(delivery, store, (child) =>
        this.publishDelivery(run, environments, store, signal, child),
      );
      return;
    }
    await this.publishDelivery(run, environments, store, signal, delivery);
  }

  /** Applies the same provider workflow to an individual accountable development branch. */
  private async publishDelivery(
    run: ExecutionRun,
    environments: RunEnvironments,
    store: DeliveryStore,
    signal: AbortSignal,
    delivery: DeliveryRecord,
  ): Promise<void> {
    if (
      delivery.publication === 'released' ||
      (delivery.environment.mode === 'live' && delivery.integration === 'merged')
    )
      return;
    if (delivery.environment.mode === 'live') {
      await this.publishLive(run, environments, store, signal, delivery);
      return;
    }
    const publication = this.simulation(run, environments, store, delivery);
    try {
      await publication.publish(signal);
    } finally {
      publication.close();
    }
  }

  /** Binds isolated publication to actual captured repositories and verification callbacks. */
  private simulation(
    run: ExecutionRun,
    environments: RunEnvironments,
    store: DeliveryStore,
    delivery: DeliveryRecord,
  ) {
    const context = environments.contextFor(run);
    const repositoryId = context.catalog.primaryRepository!;
    const checks = this.checks(context, run, delivery);
    return new SimulationPublication(
      {
        root: join(environments.directory, run.environment!.id),
        repositoryId,
        repository: context.bindings.materializations![repositoryId]!,
        effects: environments.effects,
        deliveries: store,
        policy: run.data.publicationPolicy as CapturedPublicationPolicy,
        checks: (head, cancellation, independent) => checks.check(head, cancellation, independent),
        checkAttempt: run.data.pendingPublication
          ? (run.data.publicationCheckAttempt as string | undefined)
          : undefined,
      },
      delivery,
    );
  }

  /** Uses the same host checks and captured authority for real branch delivery, without worker credentials. */
  private async publishLive(
    run: ExecutionRun,
    environments: RunEnvironments,
    store: DeliveryStore,
    signal: AbortSignal,
    delivery: DeliveryRecord,
  ): Promise<void> {
    const checks = this.checks(this.context, run, delivery);
    const publication = new LivePublication(
      {
        root: join(environments.directory, run.environment!.id),
        repositoryId: this.context.catalog.primaryRepository!,
        source: this.context.source,
        effects: environments.effects,
        deliveries: store,
        policy: run.data.publicationPolicy as CapturedPublicationPolicy,
        credential: githubHostCredential,
        checks: (head, cancellation, independent) => checks.check(head, cancellation, independent),
      },
      delivery,
    );
    await publication.publish(signal);
  }

  /** Limits publication assessment to assignments attributed to this immutable delivery. */
  private checks(
    context: ProjectExecution,
    run: ExecutionRun,
    delivery: DeliveryRecord,
  ): DeliveryChecks {
    const sourceRun = run.data.promotionSourceRun ? String(run.data.promotionSourceRun) : run.id;
    const ids = this.reviewAssignments(delivery);
    const assignments = this.execution.assignments(sourceRun).filter((a) => ids.includes(a.id));
    const publication = { ...run, data: { ...run.data, publicationDeliveryId: delivery.id } };
    return new DeliveryChecks(this.root, context, publication, assignments);
  }

  /** Rechecks every accepted criterion on the final assembled branch of a run delivery. */
  private reviewAssignments(delivery: DeliveryRecord): string[] {
    if (!delivery.parentDeliveryId) return delivery.assignmentIds;
    const store = new DeliveryStore(
      join(this.root, 'projects', this.context.key, 'deliveries.sqlite'),
      true,
    );
    try {
      const parent = store.get(delivery.parentDeliveryId);
      return parent.candidate === delivery.candidate
        ? parent.assignmentIds
        : delivery.assignmentIds;
    } finally {
      store.close();
    }
  }

  /** Keeps repeated candidate capture idempotent while attributing only completed engineering work. */
  private retain(run: ExecutionRun, policy: CapturedPublicationPolicy, store: DeliveryStore): void {
    const target = {
      repository: runDestination(this.context, run.environment!.mode),
      branch: policy.operation.targetBranch,
    };
    const prior = store
      .list()
      .find(
        (delivery) =>
          delivery.runId === run.id &&
          delivery.candidate === run.data.candidateRevision &&
          delivery.target.branch === target.branch,
      );
    const assignments = this.execution
      .assignments(run.id)
      .filter((assignment) => assignment.status === 'completed');
    const delivery =
      prior ?? new Publisher(this.root, store).capture(this.context.key, run, assignments, target);
    this.execution.updateRun(run.id, this.execution.run(run.id).status, {
      deliveryId: delivery.id,
      publicationPolicy: policy,
    });
  }
}
