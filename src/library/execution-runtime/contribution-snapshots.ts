import { join } from 'node:path';
import { covered } from '../architecture/components.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type {
  ExecutionAssignment,
  PreparedContribution,
} from '../coordination-store/execution-types.js';
import { git } from '../operations/process.js';
import { CandidateSnapshots } from '../workspace/candidates.js';

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
      if (result.status !== 'merged')
        throw new Error(`Contribution ${item.id} conflicts; retained evidence: ${result.evidence}`);
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
