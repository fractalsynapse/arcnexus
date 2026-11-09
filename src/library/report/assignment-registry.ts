import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { join } from 'node:path';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { EvidenceSet } from './evidence-set.js';
import { InvocationDiagnostics } from './invocation-diagnostics.js';
import { ExecutionEvidence } from './execution-evidence.js';

/** Projects current-run work intent and optional invocation pages without exposing arbitrary private paths. */
export class AssignmentRegistry {
  /** Binds discovery to the host store and, when supplied, its private evidence root. */
  constructor(
    private readonly store: ExecutionStore,
    private readonly root?: string,
  ) {}

  /** Captures assignment intent and optional retained diagnostics in one paged capability. */
  capture(assignment: ExecutionAssignment): EvidenceSet {
    const root = this.root;
    if (!root) throw new Error('Assignment evidence requires the host private store');
    const pages = new EvidenceSet('assignment.evidence', join(root, 'runs', assignment.runId));
    const assignments = this.append(pages, assignment);
    if (this.root)
      ExecutionEvidence.pin(
        this.root,
        assignment.runId,
        pages,
        new ExecutionEvidence(this.root, this.store).capture(assignment.runId),
      );
    const diagnostics = this.root
      ? new InvocationDiagnostics(this.root, this.store).append(pages, assignment)
      : undefined;
    pages.add(
      'manifest',
      JSON.stringify({
        runId: assignment.runId,
        assignmentId: assignment.id,
        assignments,
        ...(diagnostics ? { invocationDiagnostics: diagnostics } : {}),
        artifacts: pages.navigation(),
        basis:
          'Current-run intent and retained invocation evidence. Accepted intent and command output are observations, not verified delivery. Read only advertised artifact names; host identity and path checks remain authoritative.',
      }),
      'json',
    );
    return pages;
  }

  /** Adds the same metadata index to an investigation without changing its existing evidence boundary. */
  append(pages: EvidenceSet, assignment: ExecutionAssignment) {
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
