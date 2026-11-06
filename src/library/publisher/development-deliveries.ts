import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { DevelopmentDelivery, DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { git } from '../operations/process.js';
import { save, type RecordData } from '../workspace/state.js';

/** Preserves individual steward branches within one verified run delivery. */
export class DevelopmentDeliveries {
  /** Reads only host-retained completed assignment records. */
  constructor(private readonly root: string) {}

  /** Captures verified changes in ancestry order, rejecting gaps and duplicate branch ownership. */
  capture(assignments: ExecutionAssignment[], candidate: RecordData, head: string) {
    if (assignments.some((assignment) => assignment.data.deliveryRecordId)) return undefined;
    const entries = assignments.map((assignment) => this.entry(assignment));
    if (entries.every((entry) => entry === undefined)) return undefined;
    const changed = entries.filter((entry): entry is DevelopmentDelivery => !!entry);
    changed.sort((left, right) => {
      if (left.candidate === right.candidate) return 0;
      return this.contains(candidate.source, right.candidate, left.candidate) ? -1 : 1;
    });
    const branches = new Set<string>();
    for (const [index, entry] of changed.entries()) {
      if (branches.has(entry.branch)) throw new Error('Development branch has multiple deliveries');
      branches.add(entry.branch);
      if (!this.contains(candidate.source, head, entry.candidate))
        throw new Error('Development delivery is outside the accepted candidate');
      const previous = changed[index - 1];
      if (previous && !this.contains(candidate.source, entry.base, previous.candidate))
        throw new Error('Development delivery chain has an unverified gap');
    }
    if (changed.at(-1)?.candidate !== head)
      throw new Error('Development deliveries do not reach the accepted candidate');
    return changed;
  }

  /** Derives one immutable child from the approved manifest without widening its scope. */
  retain(parent: DeliveryRecord, entry: DevelopmentDelivery, store: DeliveryStore): DeliveryRecord {
    if (!parent.developments?.some((value) => JSON.stringify(value) === JSON.stringify(entry)))
      throw new Error('Development branch is outside the captured manifest');
    const prior = store
      .list()
      .find(
        (delivery) =>
          delivery.runId === parent.runId &&
          delivery.development?.assignmentId === entry.assignmentId &&
          delivery.candidate === entry.candidate,
      );
    if (prior) return this.reuse(parent, entry, prior, store);
    return this.reuse(parent, entry, this.captureChild(parent, entry, store), store);
  }

  /** Captures a constituent only when it belongs to the parent's immutable manifest. */
  private captureChild(
    parent: DeliveryRecord,
    entry: DevelopmentDelivery,
    store: DeliveryStore,
  ): DeliveryRecord {
    const id = createHash('sha256')
      .update(JSON.stringify([parent.id, entry]))
      .digest('hex');
    return store.capture({
      id,
      projectId: parent.projectId,
      packageId: parent.packageId,
      runId: parent.runId,
      assignmentIds: [entry.assignmentId],
      environment: parent.environment,
      authorityDigest: parent.authorityDigest,
      base: entry.base,
      candidate: entry.candidate,
      candidateRecordId: entry.recordId,
      verification: parent.verification,
      target: parent.target,
      development: entry,
      parentDeliveryId: parent.id,
      publicationDocument: parent.publicationDocument && {
        ...parent.publicationDocument,
        title: entry.owner + ': ' + parent.publicationDocument.title,
        body: `This PR delivers only the ${entry.owner} contribution at candidate \`${entry.candidate}\`. The following evidence and criteria describe the assembled task; other contributions are separate PRs.\n\n${parent.publicationDocument.body}`,
      },
    });
  }

  /** Reuses the exact assignment delivery across successive workday checkpoints without opening another PR. */
  private reuse(
    parent: DeliveryRecord,
    entry: DevelopmentDelivery,
    prior: DeliveryRecord,
    store: DeliveryStore,
  ): DeliveryRecord {
    if (
      JSON.stringify(prior.development) !== JSON.stringify(entry) ||
      prior.authorityDigest !== parent.authorityDigest ||
      prior.projectId !== parent.projectId ||
      JSON.stringify(prior.environment) !== JSON.stringify(parent.environment) ||
      JSON.stringify(prior.target) !== JSON.stringify(parent.target)
    )
      throw new Error('Retained development delivery attribution changed');
    if (parent.approval?.candidate === parent.candidate && !prior.approval)
      return store.approve(prior.id, prior.version, prior.candidate);
    return prior;
  }

  /** Publishes each captured branch sequentially and advances aggregate milestones only after all succeed. */
  async publish(
    parent: DeliveryRecord,
    store: DeliveryStore,
    publish: (child: DeliveryRecord) => Promise<void>,
  ): Promise<void> {
    if (!parent.developments?.length) throw new Error('Missing development delivery manifest');
    try {
      const last = await this.deliverBranches(parent, store, publish);
      this.complete(parent, last, store);
    } catch (error) {
      const current = store.get(parent.id);
      store.block(parent.id, current.version, String(error));
      throw error;
    }
  }

  /** Stops the chain at its first incomplete dependency and preserves each completed branch receipt. */
  private async deliverBranches(
    parent: DeliveryRecord,
    store: DeliveryStore,
    publish: (child: DeliveryRecord) => Promise<void>,
  ): Promise<DeliveryRecord> {
    let last: DeliveryRecord | undefined;
    for (const entry of parent.developments!) {
      const child = this.retain(parent, entry, store);
      if (child.delivery === 'retained') this.markBranch(entry);
      await publish(child);
      last = store.get(child.id);
      if (
        last.integration !== 'merged' ||
        (parent.environment.mode === 'simulation' && last.publication !== 'released')
      )
        throw new Error('Development branch integration is incomplete');
    }
    return last!;
  }

  /** Journals the verified branch head before publication can detach its completed evidence worktree. */
  private markBranch(entry: DevelopmentDelivery): void {
    const record = this.record(entry.recordId);
    if (
      record.branch !== entry.branch ||
      record.base !== entry.base ||
      record.status !== 'completed'
    )
      throw new Error('Development workspace changed before publication');
    if (record.developmentHead === entry.candidate) return;
    record.developmentHead = entry.candidate;
    save(this.root, record);
  }

  /** Projects successful constituent milestones onto the aggregate without generating another PR. */
  private complete(parent: DeliveryRecord, last: DeliveryRecord, store: DeliveryStore): void {
    for (const milestone of ['commit', 'push', 'pull_request', 'merge', 'release'] as const) {
      if (milestone === 'release' && parent.environment.mode === 'live') continue;
      const current = store.get(parent.id);
      store.complete(parent.id, current.version, milestone, last.receipts[milestone]!);
    }
  }

  /** Requires a real completed workspace and the snapshot accepted by the scheduler. */
  private entry(assignment: ExecutionAssignment): DevelopmentDelivery | undefined {
    if (typeof assignment.data.recordId !== 'string') return undefined;
    const record = this.record(assignment.data.recordId);
    if (record.branchBase === undefined) return undefined;
    const candidate = String(assignment.data.deliveredRevision ?? '');
    if (candidate === record.base) return undefined;
    if (
      record.status !== 'completed' ||
      record.assignmentId !== assignment.id ||
      record.executionRunId !== assignment.runId ||
      !/^codex\/run-[a-f0-9-]{36}$/.test(record.branch) ||
      !/^[a-f0-9]{40,64}$/.test(candidate)
    )
      throw new Error('Development delivery has incomplete assignment attribution');
    if (git(record.source, 'show', '-s', '--format=%P', candidate).trim() !== record.base)
      throw new Error('Development candidate has an unexpected parent');
    return {
      assignmentId: assignment.id,
      owner: assignment.owner,
      recordId: record.id,
      branch: record.branch,
      base: record.base,
      candidate,
    };
  }

  /** Rejects redirected or mismatched private records before reading branch provenance. */
  private record(id: string): RecordData {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid development record identity');
    const path = join(realpathSync(this.root), 'runs', id, 'report.json');
    const stat = lstatSync(path);
    if (realpathSync(path) !== path || !stat.isFile() || stat.nlink !== 1)
      throw new Error('Unsafe development record alias');
    const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    if (record.id !== id) throw new Error('Development record identity changed');
    return record;
  }

  /** Compares immutable Git ancestry without consulting mutable tracking refs. */
  private contains(source: string, descendant: string, ancestor: string): boolean {
    return !git(source, 'rev-list', '--max-count=1', ancestor, '--not', descendant).trim();
  }
}
