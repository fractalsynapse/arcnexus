import { AssignmentRegistry } from './assignment-registry.js';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { RecordData } from '../workspace/state.js';
import { EvidencePages } from './evidence-pages.js';
import { ExecutionEvidence } from './execution-evidence.js';

/** Captures current-run investigation facts without exposing private directories or granting recovery authority. */
export class RecoveryEvidence {
  private readonly pages = new EvidencePages('assignment.evidence');

  /** Uses only the host store's current run and assignment identities to locate retained evidence. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Pins all available same-run observations and names missing evidence explicitly in the manifest. */
  capture(assignment: ExecutionAssignment): EvidencePages {
    const current = this.store.assignment(assignment.id);
    if (current.runId !== assignment.runId || current.owner !== assignment.owner)
      throw new Error('Investigation assignment identity differs from the host store');
    const run = this.store.run(current.runId);
    const execution = new ExecutionEvidence(this.root, this.store).capture(run.id);
    ExecutionEvidence.pin(this.root, run.id, this.pages, execution);
    const records = this.store
      .assignments(run.id)
      .filter((item) => item.id !== current.id)
      .map((item) => this.assignment(item));
    this.pages.add(
      'manifest',
      JSON.stringify({
        runId: run.id,
        assignmentId: current.id,
        records,
        assignments: new AssignmentRegistry(this.store).append(this.pages, current),
        basis:
          'Pinned host observations, never permission to replay or change authority. Missing journals do not prove that a request was never attempted; inspect observed tool requests and receipts.',
        artifacts: this.pages.metadata(),
      }),
      'json',
    );
    return this.pages;
  }

  /** Rejects foreign or aliased records before exposing any of their contents. */
  private assignment(assignment: ExecutionAssignment): unknown {
    try {
      const id = assignment.data.recordId;
      if (!id) return { assignmentId: assignment.id, status: 'not_started' };
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
        throw new Error('Invalid retained record identity');
      const directory = join(this.root, 'runs', id);
      const record = JSON.parse(this.read(directory, 'report.json')) as RecordData;
      if (
        record.id !== id ||
        record.executionRunId !== assignment.runId ||
        record.assignmentId !== assignment.id
      )
        throw new Error('Retained record belongs to a different run or assignment');
      this.file(assignment.id + ':checkpoint', directory, 'checkpoint.json');
      this.journals(assignment.id, directory);
      return {
        assignmentId: assignment.id,
        recordId: id,
        status: 'captured',
        artifact: 'execution:' + assignment.id + ':record',
      };
    } catch (error) {
      return { assignmentId: assignment.id, evidenceUnavailable: true, reason: String(error) };
    }
  }

  /** Preserves transaction status and exact before/after bytes; absence stays an evidence gap. */
  private journals(assignmentId: string, directory: string): void {
    try {
      const path = join(directory, 'checked-edits');
      if (realpathSync(path) !== resolve(path)) throw new Error('Aliased checked-edit directory');
      const names = readdirSync(path)
        .filter((name) => name.endsWith('.json'))
        .sort();
      for (const name of names) this.file(assignmentId + ':edit:' + name, path, name);
      this.pages.add(assignmentId + ':edit-index', JSON.stringify({ files: names }), 'json');
    } catch (error) {
      this.pages.add(
        assignmentId + ':edit-index',
        JSON.stringify({
          evidenceUnavailable: true,
          reason: String(error),
        }),
        'json',
      );
    }
  }

  /** Retains missing or unsafe fixed artifacts explicitly instead of substituting prose summaries. */
  private file(id: string, directory: string, name: string): void {
    try {
      this.pages.add(id, this.read(directory, name), 'json');
    } catch (error) {
      this.pages.add(
        id,
        JSON.stringify({ evidenceUnavailable: true, reason: String(error) }),
        'json',
      );
    }
  }

  /** Reads only regular unaliased private artifacts; callers never supply these paths through MCP. */
  private read(directory: string, name: string): string {
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Unsafe retained evidence path');
    return readFileSync(path, 'utf8');
  }
}
