import { AssignmentAdmission } from './assignment-admission.js';
import type { ExecutionDatabase } from './execution-database.js';
import {
  canReopenAssignment,
  type ExecutionAssignment,
  type AssignmentContinuation,
  type InboxRequest,
} from './execution-types.js';

/** Keeps failed attempts inspectable while routing unresolved work to an explicitly admitted successor. */
export class AssignmentReplacements {
  /** Uses the same transaction as director admission, dependency readiness and ordered evidence. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Resolves a recorded succession chain and refuses malformed cross-authority links. */
  current(id: string): ExecutionAssignment {
    let current = this.db.get<ExecutionAssignment>('assignment', id);
    const seen = new Set<string>();
    while (typeof current.data.replacedBy === 'string') {
      if (seen.has(current.id)) throw new Error('Invalid assignment replacement cycle');
      seen.add(current.id);
      const next = this.db.get<ExecutionAssignment>('assignment', current.data.replacedBy);
      if (
        next.data.replaces !== current.id ||
        next.runId !== current.runId ||
        next.owner !== current.owner ||
        next.objective !== current.objective ||
        JSON.stringify(next.acceptance) !== JSON.stringify(current.acceptance)
      )
        throw new Error('Invalid assignment replacement authority');
      current = next;
    }
    return current;
  }

  /** Finds all envelope endpoints inherited by this assignment while preserving prior records. */
  predecessors(id: string): Set<string> {
    const result = new Set<string>();
    let current = this.db.get<ExecutionAssignment>('assignment', id);
    while (!result.has(current.id)) {
      result.add(current.id);
      if (typeof current.data.replaces !== 'string') return result;
      current = this.db.get<ExecutionAssignment>('assignment', current.data.replaces);
    }
    throw new Error('Invalid assignment replacement cycle');
  }

  /** Keeps durable request and reply identities while resolving their current accountable parties. */
  envelope(request: InboxRequest): InboxRequest {
    return {
      ...request,
      from: this.current(request.from).id,
      assignmentId: this.current(request.assignmentId).id,
    };
  }

  /** Starts isolated engineering under the same scope, retaining failed evidence and all delivery obligations. */
  replace(runId: string, decision: AssignmentContinuation): void {
    const previous = this.db.get<ExecutionAssignment>('assignment', decision.assignmentId);
    if (
      previous.runId !== runId ||
      previous.owner !== decision.ownerId ||
      !decision.reason.trim() ||
      !canReopenAssignment(previous.status)
    )
      throw new Error('Replacement requires a diagnosed assignment of the same owner and run');
    if (previous.data.replacedBy) {
      if (
        previous.data.replacementReason === decision.reason &&
        previous.data.replacementWorkflow === decision.replacementChangeType
      )
        return;
      throw new Error('Assignment already has a different replacement');
    }
    const next = this.successor(previous, decision);
    this.install(previous, next, decision);
  }

  /** Creates only a fresh change workflow with the predecessor's exact goal and acceptance. */
  private successor(previous: ExecutionAssignment, decision: AssignmentContinuation) {
    const proposal = previous.data.proposal as Record<string, unknown> | undefined;
    if (
      !proposal ||
      proposal.kind !== 'change' ||
      !['behavior', 'refactor', 'documentation'].includes(decision.replacementChangeType ?? '')
    )
      throw new Error('Workflow replacement requires an existing change assignment');
    const data = {
      proposal: { ...proposal, changeType: decision.replacementChangeType },
      replaces: previous.id,
      replacementReason: decision.reason,
      directionContext: previous.data.directionContext,
      milestones: previous.data.milestones,
      questions: previous.data.questions,
      clarification: previous.data.clarification,
    };
    return new AssignmentAdmission(this.db).create(
      previous.runId,
      previous.owner,
      previous.objective,
      previous.acceptance,
      data,
    );
  }

  /** Transfers live waits and keeps the original failed assignment and its dependency history intact. */
  private install(
    previous: ExecutionAssignment,
    next: ExecutionAssignment,
    decision: AssignmentContinuation,
  ): void {
    next.dependencies = [...previous.dependencies];
    if (next.dependencies.length || next.data.clarification) next.status = 'waiting';
    this.db.put('assignment', next);
    previous.data = {
      ...previous.data,
      replacedBy: next.id,
      replacementReason: decision.reason,
      replacementWorkflow: decision.replacementChangeType,
    };
    this.db.put('assignment', previous);
    this.redirectWaiters(previous, next);
  }

  /** Transfers each current edge and strengthens replacement waits to verified delivery. */
  private redirectWaiters(previous: ExecutionAssignment, next: ExecutionAssignment): void {
    for (const item of this.db.all<ExecutionAssignment>('assignment')) {
      if (item.runId !== previous.runId || item.data.replacedBy || item.status === 'completed')
        continue;
      if (item.dependencies.includes(previous.id)) {
        item.dependencies = item.dependencies.map((id) => (id === previous.id ? next.id : id));
        const milestones = { ...(item.data.milestones as Record<string, string> | undefined) };
        delete milestones[previous.id];
        item.data.milestones = { ...milestones, [next.id]: 'delivered' };
        if (item.status === 'ready') item.status = 'waiting';
      } else if (item.data.blockedBy !== previous.id) continue;
      if (item.status === 'blocked' && item.data.blockedBy === previous.id) {
        item.status = 'waiting';
        item.data = { ...item.data, blockedBy: null, reason: null };
      }
      this.db.put('assignment', item);
    }
  }
}
