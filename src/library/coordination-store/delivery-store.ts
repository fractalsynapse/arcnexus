import { ExecutionDatabase } from './execution-database.js';
import type { DeliveryCapture, DeliveryMilestone, DeliveryRecord } from './delivery-types.js';

/** Persists revision-bound deliveries without executing upstream actions or treating approval as verification. */
export class DeliveryStore {
  private readonly db: ExecutionDatabase;

  /** Opens private delivery state independently of transient host locks and process identities. */
  constructor(path: string, readOnly = false) {
    this.db = new ExecutionDatabase(path, readOnly);
  }

  /** Captures attribution once; duplicate capture must preserve the complete immutable intent. */
  capture(input: DeliveryCapture): DeliveryRecord {
    this.validate(input);
    return this.db.transaction('delivery.captured', { id: input.id }, () => {
      const existing = this.list().find((delivery) => delivery.id === input.id);
      if (existing) {
        for (const [key, value] of Object.entries(input))
          if (JSON.stringify(existing[key as keyof DeliveryCapture]) !== JSON.stringify(value))
            throw new Error('Delivery identity reused with changed attribution');
        return existing;
      }
      this.db.put('delivery', {
        ...input,
        version: 1,
        createdAt: new Date().toISOString(),
        engineering: 'verified',
        delivery: 'retained',
        integration: 'not_requested',
        publication: 'not_requested',
        receipts: {},
      });
      return this.get(input.id);
    });
  }

  /** Reads immutable attribution together with separately retained lifecycle outcomes. */
  get(id: string): DeliveryRecord {
    return this.db.get('delivery', id);
  }

  /** Lists retained deliveries without starting an execution host. */
  list(): DeliveryRecord[] {
    return this.db.all('delivery');
  }

  /** Records local authorization for an exact candidate; provider review remains a separate prerequisite. */
  approve(id: string, version: number, candidate: string): DeliveryRecord {
    return this.change(id, version, 'delivery.approved', (delivery) => {
      if (candidate !== delivery.candidate) throw new Error('Approval candidate mismatch');
      return {
        approval: delivery.approval ?? { candidate, authorizedAt: new Date().toISOString() },
      };
    });
  }

  /** Advances only after a durable external-effect receipt; duplicates cannot advance twice. */
  complete(
    id: string,
    version: number,
    milestone: DeliveryMilestone,
    effectId: string,
  ): DeliveryRecord {
    if (!effectId.trim()) throw new Error('Delivery transition requires an effect receipt');
    return this.change(id, version, 'delivery.' + milestone, (delivery) => {
      const prior = delivery.receipts[milestone];
      if (prior && prior !== effectId) throw new Error('Delivery milestone receipt cannot change');
      if (prior) return {};
      const state = this.transition(delivery, milestone);
      return {
        ...state,
        receipts: { ...delivery.receipts, [milestone]: effectId },
        blocker: undefined,
      };
    });
  }

  /** Retains actionable failure independently of previously completed engineering or publication milestones. */
  block(id: string, version: number, reason: string): DeliveryRecord {
    if (!reason.trim()) throw new Error('Expected delivery blocker');
    return this.change(id, version, 'delivery.blocked', () => ({ blocker: reason }));
  }

  /** Exposes ordered transitions with the shared exclusive event cursor. */
  events(after = 0) {
    return this.db.events(after);
  }

  /** Releases the database after publication or inspection. */
  close(): void {
    this.db.close();
  }

  /** Serializes stale-revision checks and transitions so partial application cannot escape. */
  private change(
    id: string,
    version: number,
    event: string,
    update: (delivery: DeliveryRecord) => Partial<DeliveryRecord>,
  ): DeliveryRecord {
    return this.db.transaction(event, { id, version }, () => {
      const delivery = this.get(id);
      if (delivery.version !== version) throw new Error('Stale delivery revision');
      const changed = { ...delivery, ...update(delivery) };
      if (JSON.stringify(changed) !== JSON.stringify(delivery)) {
        changed.version++;
        this.db.put('delivery', changed);
      }
      return this.get(id);
    });
  }

  /** Enforces milestone ordering and keeps real releases outside this increment. */
  private transition(
    delivery: DeliveryRecord,
    milestone: DeliveryMilestone,
  ): Partial<DeliveryRecord> {
    if (milestone === 'commit' && delivery.delivery === 'retained')
      return { delivery: 'committed' };
    if (milestone === 'push' && delivery.delivery === 'committed') return { delivery: 'pushed' };
    if (
      milestone === 'pull_request' &&
      delivery.delivery === 'pushed' &&
      delivery.integration === 'not_requested'
    )
      return { integration: 'pending' };
    if (milestone === 'merge' && delivery.integration === 'pending')
      return { integration: 'merged' };
    if (
      milestone === 'release' &&
      delivery.integration === 'merged' &&
      delivery.environment.mode === 'simulation'
    )
      return { publication: 'released' };
    throw new Error('Delivery milestone is out of order or not authorized for this mode');
  }

  /** Rejects incomplete identities and absent verification without inventing supporting evidence. */
  private validate(input: DeliveryCapture): void {
    const required = [
      input.id,
      input.projectId,
      input.packageId,
      input.runId,
      input.authorityDigest,
      input.base,
      input.candidate,
      ...(input.candidateRecordId === undefined ? [] : [input.candidateRecordId]),
      input.target.repository,
      input.target.branch,
      input.environment.id,
      input.verification.digest,
      ...input.assignmentIds,
      ...input.verification.references,
    ];
    if (
      required.some(
        (value) => typeof value !== 'string' || !value.trim() || value.includes('\0'),
      ) ||
      !input.assignmentIds.length ||
      !input.verification.references.length ||
      !['live', 'simulation'].includes(input.environment.mode)
    )
      throw new Error('Delivery capture requires complete attribution and verification');
  }
}
