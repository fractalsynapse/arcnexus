import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { covered } from '../architecture/components.js';
import type { ResolvedAssignment } from '../architecture/assignment.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import { git } from '../operations/process.js';
import type { Reconciliation } from '../workspace/candidates.js';
import type { RecordData } from '../workspace/state.js';

/** Routes owned text conflicts into ordinary checked engineering without accepting unresolved source. */
export class ConflictCorrection {
  /** Validates the entire proposed delta before materializing Git's unfinished merge result. */
  static capture(
    context: ProjectExecution,
    owner: string,
    record: RecordData,
    result: Extract<Reconciliation, { status: 'conflict' }>,
  ): void {
    const resolved = record.resolvedAssignment as ResolvedAssignment;
    if (resolved.assignment.kind !== 'change')
      throw new Error('Candidate conflict: ' + result.evidence);
    this.assertTextConflict(result.evidence);
    const paths = git(
      context.source,
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      result.current,
      result.revision,
    )
      .split('\0')
      .filter(Boolean);
    const conflicts = paths.filter((path) => this.inspect(context, owner, result.revision, path));
    if (!conflicts.length)
      throw new Error('Conflict needs an explicit decision: ' + result.evidence);
    record.reconciliationConflict = { ...result, paths: conflicts };
  }

  /** Keeps binary, rename and deletion conflicts outside automatic text materialization. */
  private static assertTextConflict(evidence: string): void {
    const diagnostic = readFileSync(evidence, 'utf8');
    if (
      diagnostic.includes('Cannot merge binary files') ||
      [...diagnostic.matchAll(/CONFLICT \(([^)]+)\)/g)].some(
        (match) => !['content', 'add/add'].includes(match[1]!),
      )
    )
      throw new Error('Conflict needs an explicit decision: ' + evidence);
  }

  /** Refuses cross-owner and nonregular entries; identifies editable text conflict markers. */
  private static inspect(
    context: ProjectExecution,
    owner: string,
    revision: string,
    path: string,
  ): boolean {
    if (!covered(path, context.catalog.components[owner]!.allowedWritePaths))
      throw new Error('Conflict changes another owner file: ' + path);
    const entry = git(context.source, 'ls-tree', '-z', revision, '--', path);
    if (!entry) return false;
    if (!/^100(644|755) blob /.test(entry))
      throw new Error('Conflict contains nonregular source: ' + path);
    const content = git(context.source, 'show', revision + ':' + path);
    return !content.includes('\0') && this.markers(content);
  }

  /** Keeps conflict obligations visible during every correction turn, independently of director prose. */
  static feedback(record: RecordData): string {
    if (!record.reconciliationConflict) return '';
    return (
      'Resolve the retained text conflicts through checked edits in your owned files. ' +
      'Preserve both staging behavior and the assignment requirements. Conflict markers are unfinished work; ' +
      'run owner checks before preparing. Retained merge evidence: ' +
      JSON.stringify(record.reconciliationConflict)
    );
  }

  /** Prevents an unresolved conflict from becoming even an unverified prepared contribution. */
  static assertResolved(record: RecordData): void {
    const conflict = record.reconciliationConflict as { paths: string[] } | undefined;
    for (const path of conflict?.paths ?? []) {
      let content: string;
      try {
        content = readFileSync(join(record.workspace, path), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      if (this.markers(content))
        throw new Error('Resolve retained conflict through checked edits: ' + path);
    }
  }

  /** Recognizes Git's conflict fences without treating ordinary inline examples as conflicts. */
  private static markers(content: string): boolean {
    return /^(?:<<<<<<< |=======\r?$|>>>>>>> )/m.test(content);
  }
}
