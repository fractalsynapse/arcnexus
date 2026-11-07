import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { EvidencePages } from './evidence-pages.js';

/** Adds current-run work intent to the shared assignment evidence capability. */
export class AssignmentRegistry {
  /** Binds discovery to the authoritative host store. */
  constructor(private readonly store: ExecutionStore) {}

  /** Adds the same metadata index to an investigation without changing its existing evidence boundary. */
  append(pages: EvidencePages, assignment: ExecutionAssignment) {
    const current = this.store.assignment(assignment.id);
    if (current.runId !== assignment.runId || current.owner !== assignment.owner)
      throw new Error('Registry assignment identity differs from the host store');
    return this.store
      .assignments(current.runId)
      .filter((item) => item.id !== current.id)
      .map((item) => {
        const artifact = item.id + ':intent';
        pages.add(artifact, JSON.stringify(this.intent(item)), 'json');
        return { assignmentId: item.id, owner: item.owner, status: item.status, artifact };
      });
  }

  /** Retains exact declared scope and delivery conditions; null scope fields retain their captured defaults. */
  private intent(assignment: ExecutionAssignment) {
    const proposal = assignment.data.proposal as
      | Partial<{
          kind: string;
          changeType: string;
        }>
      | undefined;
    return {
      assignmentId: assignment.id,
      owner: assignment.owner,
      objective: assignment.objective,
      acceptance: assignment.acceptance,
      status: assignment.status,
      accepted: assignment.data.accepted === true,
      scope: {
        kind: proposal?.kind ?? null,
        changeType: proposal?.changeType ?? null,
      },
      replaces: assignment.data.replaces,
      replacedBy: assignment.data.replacedBy,
      replacementReason: assignment.data.replacementReason,
      dependencies: assignment.dependencies,
      milestones: assignment.data.milestones ?? {},
    };
  }
}
