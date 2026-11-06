import { createHash } from 'node:crypto';
import { canContinueAssignment, dependencySatisfied } from './execution-types.js';
import type {
  AssignmentContinuation,
  DirectionAdmissionTransition,
  DirectionProposal,
  ExecutionAssignment,
  ExecutionRun,
  InboxRequest,
} from './execution-types.js';
import type { AssignmentAdmission } from './assignment-admission.js';
import type { AssignmentReplacements } from './assignment-replacements.js';
import type { ExecutionDatabase } from './execution-database.js';
import type { InboxDecision } from './inbox-decisions.js';

type RestoreContinuations = (runId: string, items: AssignmentContinuation[]) => void;

type RetirementRelationship = {
  raw: InboxRequest;
  request: InboxRequest;
  source: ExecutionAssignment;
  recipient: ExecutionAssignment;
  rationale?: string;
};

/** Commits direction admission and obsolete request retirement with one durable writer transaction. */
export class DirectionAdmission {
  /** Reuses execution-store admission rules, lineage validation, and continuation readiness. */
  constructor(
    private readonly db: ExecutionDatabase,
    private readonly admission: AssignmentAdmission,
    private readonly replacements: AssignmentReplacements,
    private readonly restore: RestoreContinuations,
  ) {}

  /** Identifies an already committed direction decision before repeating host-side validation. */
  admitted(runId: string, id: string): boolean {
    return this.receipt(JSON.stringify([runId, id])) !== undefined;
  }

  /** Atomically admits direction and any validated retirements through the same transaction. */
  admit(runId: string, transition: DirectionAdmissionTransition): void {
    if (!transition.id.trim()) throw new Error('Direction admission identity is empty');
    const fingerprint = createHash('sha256').update(JSON.stringify(transition)).digest('hex');
    const receiptId = JSON.stringify([runId, transition.id]);
    const created: string[] = [];
    this.db.transaction(
      'direction.admitted',
      {
        runId,
        transitionId: transition.id,
        created,
        continuations: transition.continuations,
        retirements: transition.retirements,
      },
      () => {
        this.db.get<ExecutionRun>('run', runId);
        const prior = this.receipt(receiptId);
        if (prior) return this.assertSameAdmission(prior, fingerprint);
        this.retireRequests(runId, transition);
        this.restore(runId, transition.continuations);
        this.waitOnOutstandingDependencies(transition);
        this.createProposals(runId, transition.proposals, created);
        this.saveCheckpoint(runId, transition, receiptId, fingerprint);
      },
    );
  }

  /** Rejects reuse of a durable transition identity with different validated input. */
  private assertSameAdmission(prior: { fingerprint: string }, fingerprint: string): void {
    if (prior.fingerprint !== fingerprint)
      throw new Error('Direction admission identity reused with different content');
  }

  /** Looks up a receipt that prevents replay from creating duplicate assignments. */
  private receipt(id: string): { fingerprint: string } | undefined {
    return this.db
      .all<{ id: string; fingerprint: string }>('direction-admission')
      .find((item) => item.id === id);
  }

  /** Creates proposal assignments only on the first successful admission. */
  private createProposals(runId: string, proposals: DirectionProposal[], created: string[]): void {
    for (const item of proposals)
      created.push(
        this.admission.create(runId, item.owner, item.objective, item.acceptance, { ...item.data })
          .id,
      );
  }

  /** Persists the updated checkpoint and idempotency receipt in the admission transaction. */
  private saveCheckpoint(
    runId: string,
    transition: DirectionAdmissionTransition,
    receiptId: string,
    fingerprint: string,
  ): void {
    const run = this.db.get<ExecutionRun>('run', runId);
    this.db.put('run', { ...run, data: { ...run.data, ...transition.checkpoint } });
    this.db.put('direction-admission', { id: receiptId, fingerprint });
  }

  /** Validates every retirement before changing request or assignment state. */
  private retireRequests(runId: string, transition: DirectionAdmissionTransition): void {
    const continuationIds = new Set(transition.continuations.map((item) => item.assignmentId));
    const seen = new Set<string>();
    const relationships = transition.retirements.map((item) =>
      this.relationship(runId, item, continuationIds, seen),
    );
    for (const item of relationships) this.retireRelationship(item, transition.id);
  }

  /** Resolves a current request and rejects stale, duplicated, or unrelated identities. */
  private relationship(
    runId: string,
    item: DirectionAdmissionTransition['retirements'][number],
    continuationIds: Set<string>,
    seen: Set<string>,
  ): RetirementRelationship {
    if (seen.has(item.requestId)) throw new Error('Duplicate request retirement');
    seen.add(item.requestId);
    const source = this.db.get<ExecutionAssignment>('assignment', item.assignmentId);
    const raw = this.db.get<InboxRequest>('request', item.requestId);
    const request = this.replacements.envelope(raw);
    const recipient = this.db.get<ExecutionAssignment>('assignment', request.assignmentId);
    this.assertRelationship(runId, source, raw, request, recipient, continuationIds);
    this.assertRetirementSafe(source, request, recipient);
    return { raw, request, source, recipient, rationale: item.rationale };
  }

  /** Requires a live request edge from an eligible continuation in the same run. */
  private assertRelationship(
    runId: string,
    source: ExecutionAssignment,
    raw: InboxRequest,
    request: InboxRequest,
    recipient: ExecutionAssignment,
    continuationIds: Set<string>,
  ): void {
    if (
      source.runId !== runId ||
      source.id !== request.from ||
      !continuationIds.has(source.id) ||
      !canContinueAssignment(source.status) ||
      source.data.replacedBy ||
      !source.dependencies.includes(recipient.id) ||
      recipient.runId !== runId ||
      raw.retired
    )
      throw new Error('Invalid or stale request retirement relationship');
  }

  /** Refuses retirement while supplier work or a correlated clarification remains in flight. */
  private assertRetirementSafe(
    source: ExecutionAssignment,
    request: InboxRequest,
    recipient: ExecutionAssignment,
  ): void {
    if (['running', 'interrupted'].includes(recipient.status))
      throw new Error('Cannot retire an in-flight dependency request');
    if (
      (recipient.data.clarification as InboxDecision | undefined)?.requestId === request.id ||
      ((source.data.questions as InboxDecision[] | undefined) ?? []).some(
        (question) => question.requestId === request.id,
      )
    )
      throw new Error('Cannot retire a request with an in-flight clarification');
  }

  /** Retains shared supplier work while removing one obsolete requester obligation. */
  private retireRelationship(item: RetirementRelationship, transitionId: string): void {
    this.db.put('request', {
      ...item.raw,
      retired: true,
      retiredByAdmission: transitionId,
      retirementRationale: item.rationale,
    });
    if (this.hasOtherRequest(item.source.id, item.recipient.id, item.raw.id)) return;
    const source = this.db.get<ExecutionAssignment>('assignment', item.source.id);
    if (this.hasExplicitLink(source.id, item.recipient.id)) return;
    source.dependencies = source.dependencies.filter((id) => id !== item.recipient.id);
    const milestones = { ...(source.data.milestones as Record<string, string> | undefined) };
    delete milestones[item.recipient.id];
    source.data.milestones = milestones;
    this.db.put('assignment', source);
  }

  /** Waits resumed sources on any dependency that remains unsatisfied after retirement. */
  private waitOnOutstandingDependencies(transition: DirectionAdmissionTransition): void {
    const sourceIds = new Set(transition.retirements.map((item) => item.assignmentId));
    for (const id of sourceIds) {
      const source = this.db.get<ExecutionAssignment>('assignment', id);
      if (source.status !== 'ready') continue;
      const waiting = source.dependencies.some((dependencyId) => {
        const dependency = this.db.get<ExecutionAssignment>('assignment', dependencyId);
        return !dependencySatisfied(source, dependency);
      });
      if (waiting) this.db.put('assignment', { ...source, status: 'waiting' });
    }
  }

  /** Detects another active request preserving the same requester-to-supplier dependency. */
  private hasOtherRequest(sourceId: string, recipientId: string, retiredId: string): boolean {
    return this.db.all<InboxRequest>('request').some((item) => {
      if (item.id === retiredId || item.retired) return false;
      const current = this.replacements.envelope(item);
      return current.from === sourceId && current.assignmentId === recipientId;
    });
  }

  /** Preserves independently linked obligations using their durable host events across replacements. */
  private hasExplicitLink(sourceId: string, recipientId: string): boolean {
    return this.db.events().some((event) => {
      if (event.type !== 'dependency.linked') return false;
      return (
        this.replacements.current(String(event.data.from)).id === sourceId &&
        this.replacements.current(String(event.data.to)).id === recipientId
      );
    });
  }
}
