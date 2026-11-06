import { AssignmentReplacements } from './assignment-replacements.js';
import type { ExecutionDatabase } from './execution-database.js';
import type { ExecutionAssignment, InboxRequest } from './execution-types.js';

export interface InboxDecision {
  requestId: string;
  action: 'accept' | 'reject' | 'clarify' | 'answer' | 'require_delivery';
  text: string;
}

/** Validates correlated inbox replies and updates readiness inside the store's transaction. */
export class InboxDecisions {
  /** Shares the single transactional writer; it never opens a second connection. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Projects inherited conversations onto their active parties and keeps failed attempts inspectable. */
  messages(id: string) {
    const lineage = new AssignmentReplacements(this.db);
    const archived = Boolean(this.db.get<ExecutionAssignment>('assignment', id).data.replacedBy);
    const endpoints = archived ? new Set([id]) : lineage.predecessors(id);
    const replies = this.db.all<InboxDecision & { actor: string }>('reply');
    return this.db
      .all<InboxRequest>('request')
      .filter((r) => !r.retired && (endpoints.has(r.from) || endpoints.has(r.assignmentId)))
      .map((original) => {
        const request = archived ? original : lineage.envelope(original);
        return {
          ...request,
          ...this.context(id, request),
          replies: replies.filter((reply) => reply.requestId === request.id),
        };
      });
  }

  /** Projects assignment-relative action guidance from the same states checked during replies. */
  context(actor: string, request: InboxRequest) {
    const recipient = this.db.get<ExecutionAssignment>('assignment', request.assignmentId);
    const requester = this.db.get<ExecutionAssignment>('assignment', request.from);
    const outgoing = actor === request.from;
    const requiredMilestone =
      (requester.data.milestones as Record<string, string> | undefined)?.[recipient.id] ??
      'delivered';
    const candidates: InboxDecision['action'][] = outgoing
      ? ['answer', 'require_delivery']
      : ['accept', 'reject', 'clarify'];
    const availableActions = candidates.filter((action) =>
      this.available(request, recipient, requester, requiredMilestone, action),
    );
    return {
      direction: outgoing ? 'outgoing' : 'incoming',
      requesterStatus: requester.status,
      recipientStatus: recipient.status,
      requiredMilestone,
      availableActions,
    };
  }

  /** Omits no-op acknowledgments and actions that current transactional validation would reject. */
  private available(
    request: InboxRequest,
    recipient: ExecutionAssignment,
    requester: ExecutionAssignment,
    milestone: string,
    action: InboxDecision['action'],
  ): boolean {
    if (this.terminal(recipient)) return false;
    if (action === 'accept' && recipient.data.accepted) return false;
    if (action === 'require_delivery' && milestone === 'delivered') return false;
    if (
      action === 'answer' &&
      (recipient.data.clarification as InboxDecision | undefined)?.requestId !== request.id
    )
      return false;
    try {
      this.validate(recipient, requester, { action, requestId: request.id, text: 'Context' });
      return true;
    } catch {
      return false;
    }
  }

  /** Identifies final assignment states without treating ordinary dependency waits as failures. */
  private terminal(item: ExecutionAssignment): boolean {
    return ['completed', 'rejected', 'failed', 'interrupted'].includes(item.status);
  }

  /** Applies a recipient decision or an originating assignment's read-only answer. */
  apply(actor: string, decision: InboxDecision): boolean {
    if (!decision.text.trim()) throw new Error('Inbox decision requires an explanation');
    const id = JSON.stringify([decision.requestId, actor, decision.action, decision.text]);
    if (this.db.all<{ id: string }>('reply').some((r) => r.id === id)) return false;
    const raw = this.db.get<InboxRequest>('request', decision.requestId);
    if (raw.retired) throw new Error('Cannot respond to a retired request');
    const request = new AssignmentReplacements(this.db).envelope(raw);
    const requesterAction = ['answer', 'require_delivery'].includes(decision.action);
    if (actor !== (requesterAction ? request.from : request.assignmentId))
      throw new Error('Inbox reply has unauthorized sender');
    const recipient = this.db.get<ExecutionAssignment>('assignment', request.assignmentId);
    const requester = this.db.get<ExecutionAssignment>('assignment', request.from);
    this.validate(recipient, requester, decision);
    this.transition(requester, recipient, decision);
    this.db.put('assignment', recipient);
    this.db.put('assignment', requester);
    this.db.put('reply', {
      id,
      actor,
      ...decision,
    });
    return true;
  }

  /** Applies one correlated lifecycle change while leaving accepted recipient scope untouched. */
  private transition(
    requester: ExecutionAssignment,
    recipient: ExecutionAssignment,
    decision: InboxDecision,
  ): void {
    if (decision.action === 'require_delivery') {
      requester.data.milestones = {
        ...(requester.data.milestones as object),
        [recipient.id]: 'delivered',
      };
      requester.status = 'waiting';
      return;
    }
    if (decision.action === 'answer') this.answer(requester, recipient, decision);
    else if (decision.action === 'clarify') this.clarify(requester, recipient, decision);
    else if (decision.action === 'accept') recipient.data.accepted = true;
    else {
      recipient.status = 'rejected';
      recipient.data.reason = decision.text;
    }
  }

  /** Preserves terminal delivery and prevents a new question from overwriting an unanswered one. */
  private validate(
    recipient: ExecutionAssignment,
    requester: ExecutionAssignment,
    decision: InboxDecision,
  ): void {
    if (decision.action === 'require_delivery') {
      if (this.terminal(requester)) throw new Error('Cannot change a terminal requester');
      return;
    }
    if (this.terminal(recipient) || (decision.action === 'answer' && this.terminal(requester)))
      throw new Error('New inbox decisions cannot change terminal assignments');
    if (decision.action !== 'clarify') return;
    if (this.terminal(requester))
      throw new Error('Cannot ask a terminal requester for clarification');
    if (recipient.data.clarification) throw new Error('A clarification is already pending');
  }

  /** Suspends recipient planning and schedules a read-only requester control turn. */
  private clarify(
    requester: ExecutionAssignment,
    recipient: ExecutionAssignment,
    decision: InboxDecision,
  ): void {
    recipient.status = 'waiting';
    recipient.data.clarification = decision;
    requester.data.questions = [...((requester.data.questions ?? []) as InboxDecision[]), decision];
    requester.status = 'ready';
  }

  /** Correlates an answer without pretending the requester has finished its engineering assignment. */
  private answer(
    requester: ExecutionAssignment,
    recipient: ExecutionAssignment,
    decision: InboxDecision,
  ): void {
    const question = recipient.data.clarification as InboxDecision | undefined;
    if (question?.requestId !== decision.requestId)
      throw new Error('No matching clarification is pending');
    requester.data.questions = ((requester.data.questions ?? []) as InboxDecision[]).filter(
      (q) => q.requestId !== decision.requestId,
    );
    requester.status = (requester.data.questions as InboxDecision[]).length ? 'ready' : 'waiting';
    recipient.data.answer = decision.text;
    delete recipient.data.clarification;
    recipient.status = 'ready';
  }
}
