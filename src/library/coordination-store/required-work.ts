import { dependencySatisfied } from './execution-types.js';
import type { ExecutionDatabase } from './execution-database.js';
import type { AssignmentReplacements } from './assignment-replacements.js';
import type { ExecutionAssignment, InboxRequest } from './execution-types.js';

/** Derives dispatch and goal obligations from retained request origins and current dependency edges. */
export class RequiredWork {
  /** Shares authoritative entities and lineage with the execution store; owns no parallel state. */
  constructor(
    private readonly db: ExecutionDatabase,
    private readonly lineage: AssignmentReplacements,
  ) {}

  /** Keeps independently admitted work and reachable suppliers while retaining orphan history separately. */
  assignments(runId: string): ExecutionAssignment[] {
    const all = this.db
      .all<ExecutionAssignment>('assignment')
      .filter((item) => item.runId === runId);
    const requests = this.db
      .all<InboxRequest>('request')
      .map((item) => this.lineage.envelope(item));
    if (!requests.some((item) => item.retired && all.some((a) => a.id === item.from))) return all;
    const created = new Set(
      requests.filter((item) => !item.existingAssignmentId).map((item) => item.assignmentId),
    );
    const required = new Set<string>();
    for (const item of all) {
      const current = this.lineage.current(item.id);
      if (!created.has(current.id) || current.data.directionContext) this.visit(current, required);
    }
    return all.filter((item) => required.has(item.id));
  }

  /** Orders eligible reachable work by the durable ready clock and required milestones. */
  ready(runId: string): ExecutionAssignment[] {
    return this.assignments(runId)
      .filter(
        (item) =>
          item.status === 'ready' &&
          ((Array.isArray(item.data.questions) && item.data.questions.length > 0) ||
            item.dependencies.every((id) =>
              dependencySatisfied(item, this.db.get<ExecutionAssignment>('assignment', id)),
            )),
      )
      .sort((a, b) => Number(a.data.readyOrder ?? 0) - Number(b.data.readyOrder ?? 0));
  }

  /** Follows current dependency identities once, preserving shared and explicit obligations. */
  private visit(item: ExecutionAssignment, required: Set<string>): void {
    if (required.has(item.id)) return;
    required.add(item.id);
    for (const id of item.dependencies) this.visit(this.lineage.current(id), required);
  }
}
