import { CandidatePointers } from './candidate-pointers.js';
import { ContributionGroups } from './contribution-groups.js';
import type { ExecutionDatabase } from './execution-database.js';
import {
  dependencySatisfied,
  type ExecutionAssignment,
  type ExecutionRun,
  type PreparedContribution,
} from './execution-types.js';

/** Commits contribution readiness and joint verified delivery through the existing execution database. */
export class ContributionDelivery {
  /** Shares the store transaction and its ordinary readiness propagation. */
  constructor(
    private readonly db: ExecutionDatabase,
    private readonly wake: (runId: string) => void,
  ) {}

  /** Retains prepared source without advancing the verified candidate or emitting a delivery receipt. */
  prepare(id: string, contribution: PreparedContribution): void {
    this.db.transaction('assignment.prepared', { id, contribution }, () => {
      const item = this.db.get<ExecutionAssignment>('assignment', id);
      if (
        !['running', 'ready', 'prepared'].includes(item.status) ||
        item.data.replacedBy ||
        !ContributionGroups.engineering(item)
      )
        throw new Error('Assignment cannot prepare from its current state');
      if (
        item.data.recordId !== contribution.recordId ||
        !/^[a-f0-9-]{36}$/.test(contribution.recordId) ||
        ![contribution.base, contribution.revision, contribution.checkpoint].every(
          (v) => typeof v === 'string' && /^[a-f0-9]{40,64}$/.test(v),
        )
      )
        throw new Error('Prepared contribution does not match its retained checkpoint');
      if (
        item.status === 'prepared' &&
        JSON.stringify(item.data.contribution) !== JSON.stringify(contribution)
      )
        throw new Error('Prepared contribution changed without engineering continuation');
      this.db.put('assignment', {
        ...item,
        status: 'prepared',
        data: { ...item.data, contribution },
      });
      this.wake(item.runId);
    });
  }

  /** Publishes all verified members and the candidate atomically, rejecting partial or stale assembly. */
  complete(
    ids: string[],
    evidence: string[],
    candidate?: Record<string, unknown>,
    prepared?: PreparedContribution[],
  ): void {
    this.db.transaction('assignment.delivered', { id: ids[0], ids, evidence }, () => {
      const items = ids.map((id) => this.db.get<ExecutionAssignment>('assignment', id));
      if (!items.length || new Set(ids).size !== ids.length || !evidence.length)
        throw new Error('Verified delivery requires unique assignments and evidence');
      if (items.some((item) => item.runId !== items[0]!.runId || item.data.replacedBy))
        throw new Error('Delivery contains foreign or replaced work');
      if (items.every((item) => item.status === 'completed'))
        return this.duplicate(items, evidence, candidate);
      if (items.some((item) => item.status === 'completed')) throw new Error('Partial delivery');
      if (!prepared && items.some((item) => item.status === 'prepared'))
        throw new Error('Prepared contributions require assembled verification');
      if (prepared) {
        this.prepared(items, prepared);
        this.baseline(items[0]!.runId, candidate);
      }
      this.dependencies(items);
      this.publish(items, evidence, candidate);
    });
  }

  /** Writes correlated receipts and advances their one shared candidate inside the caller's transaction. */
  private publish(
    items: ExecutionAssignment[],
    evidence: string[],
    candidate?: Record<string, unknown>,
  ): void {
    for (const item of items)
      this.db.put('assignment', {
        ...item,
        status: 'completed',
        evidence,
        data: {
          ...item.data,
          deliveredRevision: candidate?.candidateRevision,
          ...(candidate?.assemblyBase
            ? {
                deliveryRecordId: (candidate.candidateRecord as { id?: string } | undefined)?.id,
              }
            : {}),
        },
      });
    if (candidate) new CandidatePointers(this.db).promote(items[0]!.runId, candidate);
    this.wake(items[0]!.runId);
  }

  /** Rejects verification against a candidate superseded while the combined result was being checked. */
  private baseline(runId: string, candidate?: Record<string, unknown>): void {
    const run = this.db.get<ExecutionRun>('run', runId);
    const current = run.data.candidateRevision ?? run.data.authorityBase;
    if (
      !candidate ||
      typeof candidate.assemblyBase !== 'string' ||
      candidate.assemblyBase !== current
    )
      throw new Error('Assembled candidate baseline changed after verification');
  }

  /** Checks the exact frozen contribution set before any member or candidate pointer can change. */
  private prepared(items: ExecutionAssignment[], prepared: PreparedContribution[]): void {
    const all = this.db
      .all<ExecutionAssignment>('assignment')
      .filter((a) => a.runId === items[0]!.runId);
    const group = new ContributionGroups(all).group(items[0]!.id);
    if (group.length !== items.length || group.some((a) => !items.some((b) => a.id === b.id)))
      throw new Error('Assembled delivery must include the complete related contribution set');
    if (
      prepared.length !== items.length ||
      items.some(
        (item, index) =>
          item.status !== 'prepared' ||
          JSON.stringify(item.data.contribution) !== JSON.stringify(prepared[index]),
      )
    )
      throw new Error('Assembled contribution changed after verification');
  }

  /** Internal group obligations resolve together; unrelated dependencies still require their actual milestone. */
  private dependencies(items: ExecutionAssignment[]): void {
    const ids = new Set(items.map((item) => item.id));
    for (const item of items)
      for (const id of item.dependencies) {
        if (!ids.has(id) && !dependencySatisfied(item, this.db.get('assignment', id)))
          throw new Error('Undelivered dependencies');
      }
  }

  /** An idempotent replay cannot replace the exact verification or revision already delivered. */
  private duplicate(
    items: ExecutionAssignment[],
    evidence: string[],
    candidate?: Record<string, unknown>,
  ): void {
    if (
      items.some(
        (item) =>
          JSON.stringify(item.evidence) !== JSON.stringify(evidence) ||
          item.data.deliveredRevision !== candidate?.candidateRevision,
      )
    )
      throw new Error('Duplicate delivery disagrees with retained verification');
  }
}
