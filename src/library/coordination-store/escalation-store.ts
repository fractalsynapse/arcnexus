import { randomUUID } from 'node:crypto';
import type { ExecutionDatabase } from './execution-database.js';
import type { ExecutionAssignment } from './execution-types.js';

/**
 * One owner's recorded wait on another, kept as its own entity.
 *
 * A blocked activation is not a failure and not a human gate: it is a statement that this owner
 * cannot close its acceptance until someone else acts. Recording it as an entity makes the wait
 * visible in the store instead of only inside a run's error text, so the counterpart — or a human
 * reading the project — sees who is waiting, on what, with which steps still open and which
 * evidence already exists. Resolving it closes the entity and never rewrites the goal or its
 * acceptance criteria.
 */
export interface Escalation {
  id: string;
  runId: string;
  assignmentId: string;
  owner: string;
  /** Goal identity captured at the moment of escalation; the authority the owner was working to. */
  goal: { objective: string; acceptance: string[] };
  /** Plan revision the owner was executing, so the reopened work starts from the same reasoning. */
  planRevision?: number;
  /** Checklist items still open, with the activity bucket each belongs to. */
  openSteps: Array<{ id: string; activity: string; status: string }>;
  evidence: string[];
  reason: string;
  openedAt: string;
  closedAt?: string;
  resolution?: string;
}

/** Opens, reads and closes escalations without a parallel state projection. */
export class Escalations {
  /** Shares the authoritative execution database; owns no storage of its own. */
  constructor(private readonly db: ExecutionDatabase) {}

  /**
   * Records that this owner is waiting, unless the same assignment already waits for the same
   * reason. A repeat activation of a still-blocked owner must not accumulate duplicate entities.
   */
  open(input: Omit<Escalation, 'id' | 'openedAt'>): Escalation {
    const existing = this.outstanding(input.runId).find(
      (item) => item.assignmentId === input.assignmentId && item.reason === input.reason,
    );
    if (existing) return existing;
    const escalation: Escalation = {
      ...input,
      id: randomUUID(),
      openedAt: new Date().toISOString(),
    };
    this.db.put('escalation', escalation);
    return escalation;
  }

  /** Reads one escalation by identity. */
  get(id: string): Escalation {
    return this.db.get<Escalation>('escalation', id);
  }

  /** Lists every unresolved escalation, oldest first, so a reader sees the queue as it formed. */
  outstanding(runId?: string): Escalation[] {
    return this.db
      .all<Escalation>('escalation')
      .filter((item) => !item.closedAt && (!runId || item.runId === runId))
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  }

  /** Lists every escalation the given assignment has raised, open or closed. */
  forAssignment(assignment: ExecutionAssignment): Escalation[] {
    return this.db
      .all<Escalation>('escalation')
      .filter((item) => item.assignmentId === assignment.id);
  }

  /**
   * Closes an escalation with the answer or action that resolved it.
   *
   * The goal identity and acceptance criteria are left exactly as recorded at open: a resolution
   * ends a wait, it does not restate the work. Repeated resolution is idempotent so replaying an
   * effect cannot rewrite the closing record.
   */
  close(id: string, resolution: string): Escalation {
    const current = this.get(id);
    if (current.closedAt) return current;
    const closed: Escalation = { ...current, closedAt: new Date().toISOString(), resolution };
    this.db.put('escalation', closed);
    return closed;
  }

  /** Closes every outstanding escalation raised by an assignment, recording what ended the wait. */
  closeForAssignment(assignmentId: string, resolution: string): number {
    const open = this.outstanding().filter((item) => item.assignmentId === assignmentId);
    for (const item of open) this.close(item.id, resolution);
    return open.length;
  }
}
