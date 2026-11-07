import { join } from 'node:path';
import { covered } from '../architecture/components.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type {
  ExecutionAssignment,
  PreparedContribution,
} from '../coordination-store/execution-types.js';
import { git } from '../operations/process.js';
import { CandidateSnapshots, type Reconciliation } from '../workspace/candidates.js';

/** Identifies an ordinary source conflict without treating ownership or uncertain effects as recoverable. */
export class ContributionConflict extends Error {
  /** Retains the accountable owner and both source versions for the existing director correction loop. */
  constructor(
    readonly assignmentId: string,
    readonly owner: string,
    readonly conflict: Extract<Reconciliation, { status: 'conflict' }>,
  ) {
    super(`Contribution ${assignmentId} conflicts; retained evidence: ${conflict.evidence}`);
  }
}

/** Reconciles attributed contribution objects without changing any steward workspace or verified pointer. */
export class ContributionSnapshots {
  private readonly snapshots: CandidateSnapshots;

  /** Uses the captured component catalog and the existing private snapshot store. */
  constructor(
    root: string,
    private readonly context: ProjectExecution,
  ) {
    this.snapshots = new CandidateSnapshots(context.source, join(root, 'snapshots'));
  }

  /** Builds one candidate from exact prepared receipts, retaining all conflict objects on failure. */
  assemble(base: string, assignments: ExecutionAssignment[]): string {
    if (
      !assignments.length ||
      new Set(assignments.map((item) => item.id)).size !== assignments.length
    )
      throw new Error('Assembly requires distinct accountable contributions');
    if (assignments.some((item) => item.runId !== assignments[0]!.runId))
      throw new Error('Assembly cannot combine contributions from different runs');
    let revision = base;
    for (const item of assignments) {
      const contribution = this.contribution(item);
      const result = this.snapshots.reconcile(contribution.base, revision, contribution.revision);
      if (result.status !== 'merged') throw new ContributionConflict(item.id, item.owner, result);
      revision = result.revision;
    }
    return revision;
  }

  /** Validates immutable Git attribution against component ownership before composing source trees. */
  private contribution(item: ExecutionAssignment): PreparedContribution {
    const contribution = item.data.contribution as PreparedContribution | undefined;
    if (item.status !== 'prepared' || !contribution || contribution.recordId !== item.data.recordId)
      throw new Error('Assembly requires the current prepared contribution');
    const owner = this.context.catalog.components[item.owner];
    if (!owner || !this.context.owners.includes(item.owner))
      throw new Error('Contribution owner is outside captured authority');
    const paths = git(
      this.context.source,
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      contribution.base,
      contribution.revision,
      '--',
    )
      .split('\0')
      .filter(Boolean);
    for (const path of paths) {
      if (!covered(path, owner.allowedWritePaths))
        throw new Error(`Contribution ${item.id} changes another owner's file: ${path}`);
      this.regular(contribution.revision, path);
    }
    return contribution;
  }

  /** Rejects links and submodules in proposed source; deletions remain valid owned changes. */
  private regular(revision: string, path: string): void {
    const entry = git(this.context.source, 'ls-tree', '-z', revision, '--', path);
    if (entry && !/^100(644|755) blob /.test(entry))
      throw new Error(`Contribution contains unsupported source entry: ${path}`);
  }
}
