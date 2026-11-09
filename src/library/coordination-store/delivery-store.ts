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
        route: undefined,
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
    mergedHead?: string,
  ): DeliveryRecord {
    if (!effectId.trim()) throw new Error('Delivery transition requires an effect receipt');
    return this.change(id, version, 'delivery.' + milestone, (delivery) => {
      const prior = delivery.receipts[milestone];
      if (prior && prior !== effectId) throw new Error('Delivery milestone receipt cannot change');
      if (prior) return {};
      const state = this.transition(delivery, milestone, mergedHead);
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

  /**
   * Enforces milestone order and records the provider's merge identity once.
   *
   * Merge writes the identity; release marks the same route rather than a second status column, so
   * every view derives from one recorded fact. Ordering and authorization keep the wording the
   * delivery contract and its acceptance tests were written against.
   */
  private transition(
    delivery: DeliveryRecord,
    milestone: DeliveryMilestone,
    mergedHead?: string,
  ): Partial<DeliveryRecord> {
    this.order(delivery, milestone);
    if (milestone === 'merge')
      return {
        route: {
          head: mergedHead ?? '',
          receipt: String(delivery.receipts.merge ?? ''),
          integratedAt: new Date().toISOString(),
          released: false,
        },
      };
    if (milestone === 'release') {
      if (!delivery.route || delivery.environment.mode !== 'simulation')
        throw new Error('Delivery milestone is out of order or not authorized for this mode');
      return { route: { ...delivery.route, released: true } };
    }
    return {};
  }

  /** Rejects a milestone whose predecessor was never recorded, keeping the contract's wording. */
  private order(delivery: DeliveryRecord, milestone: DeliveryMilestone): void {
    const required: Partial<Record<DeliveryMilestone, DeliveryMilestone>> = {
      push: 'commit',
      pull_request: 'push',
      merge: 'pull_request',
    };
    const prior = required[milestone];
    if (prior && !delivery.receipts[prior])
      throw new Error('Delivery milestone is out of order or not authorized for this mode');
    if (milestone === 'release' && !delivery.receipts.merge)
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
