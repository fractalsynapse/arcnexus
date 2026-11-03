import { join } from 'node:path';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import {
  PublicationPolicy,
  Publisher,
  DeliveryResources,
  DeliveryChecks,
  SimulationPublication,
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

  /** Persists explicit publication intent for sequential dispatch after the current activation checkpoint. */
  request(id: string, expectedRevision?: string) {
    const delivery = new DeliveryResources(this.root).get(id);
    if (expectedRevision !== undefined && delivery.revision !== expectedRevision)
      throw new Error('Stale delivery revision');
    if (delivery.projectId !== this.context.key) throw new Error('Foreign delivery project');
    if (delivery.environment.mode !== 'simulation')
      throw new Error('Live publication is not yet available');
    const run = this.execution.run(delivery.runId);
    if (
      run.data.executionIdentity !== delivery.authorityDigest ||
      delivery.authorityDigest !== executionIdentity(this.context)
    )
      throw new Error('Delivery authority differs from retained run');
    if (run.data.pendingPublication && run.data.pendingPublication !== id)
      throw new Error('This run already has a queued publication');
    if (delivery.publication !== 'released')
      this.execution.updateRun(run.id, run.status, { pendingPublication: id });
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
    if (
      !(retained.data.pendingPublication || retained.data.deliveryId) ||
      retained.environment?.mode !== 'simulation'
    )
      return;
    const store = new DeliveryStore(
      join(this.root, 'projects', this.context.key, 'deliveries.sqlite'),
    );
    try {
      await this.publish(retained, environments, store, signal);
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

  /** Uses frozen isolated repositories and actual check/verifier services for the provider workflow. */
  private async publish(
    run: ExecutionRun,
    environments: RunEnvironments,
    store: DeliveryStore,
    signal: AbortSignal,
  ) {
    const context = environments.contextFor(run);
    const delivery = store.get(String(run.data.pendingPublication ?? run.data.deliveryId));
    if (delivery.publication === 'released' || (delivery.blocker && !run.data.pendingPublication))
      return;
    const repositoryId = context.catalog.primaryRepository!;
    const checks = this.checks(context, run, delivery.assignmentIds);
    const publication = new SimulationPublication(
      {
        root: join(environments.directory, run.environment!.id),
        repositoryId,
        repository: context.bindings.materializations![repositoryId]!,
        effects: environments.effects,
        deliveries: store,
        policy: run.data.publicationPolicy as CapturedPublicationPolicy,
        checks: (head, cancellation, independent) => checks.check(head, cancellation, independent),
      },
      delivery,
    );
    try {
      await publication.publish(signal);
    } finally {
      publication.close();
    }
  }

  /** Limits publication assessment to assignments attributed to this immutable delivery. */
  private checks(context: ProjectExecution, run: ExecutionRun, ids: string[]): DeliveryChecks {
    const assignments = this.execution.assignments(run.id).filter((a) => ids.includes(a.id));
    return new DeliveryChecks(this.root, context, run, assignments);
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
