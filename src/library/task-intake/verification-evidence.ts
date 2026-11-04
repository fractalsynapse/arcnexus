import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidateDigest, captureChanges } from '../change-inspection/changes.js';
import type { OperationBridge } from '../operations/operations.js';
import { EvidencePages } from '../report/report.js';
import type { RecordData } from '../workspace/state.js';

/** Pins host-observed changes and exposes only their retained artifacts to independent reviewers. */
export class VerificationEvidence {
  private readonly pages = new EvidencePages('verification.evidence');

  readonly candidate: string;

  /** Captures complete change evidence outside the editable candidate and rejects concurrent changes. */
  constructor(root: string, record: RecordData, baseline: string) {
    this.candidate = candidateDigest(record);
    const captured: RecordData = { ...record, base: baseline };
    captureChanges(root, captured);
    const directory = join(root, 'runs', record.id);
    this.pages.add(
      'patch',
      readFileSync(join(directory, 'changes.patch'), 'utf8'),
      'git-binary-patch',
    );
    this.addFiles(JSON.parse(readFileSync(join(directory, 'new-files.json'), 'utf8')));
    this.execution(record);
    const manifest = {
      baseline,
      candidateDigest: this.candidate,
      changes: captured.changes,
      artifacts: this.pages.metadata(),
    };
    this.pages.add('manifest', JSON.stringify(manifest, null, 2), 'json');
    record.verificationEvidence = this.pages.retain(directory, manifest);
    if (candidateDigest(record) !== this.candidate)
      throw Object.assign(new Error('Candidate changed during evidence capture'), {
        name: 'CandidateIntegrityError',
      });
  }

  /** Pins current-run host observations without accepting a foreign task as execution evidence. */
  private execution(record: RecordData): void {
    const evidence = record.hostExecutionEvidence as { run?: { id?: string } } | undefined;
    if (!evidence) return;
    if (!record.executionRunId || evidence.run?.id !== record.executionRunId)
      throw new Error('Host execution evidence belongs to a different run');
    this.pages.add('execution', JSON.stringify(evidence, null, 2), 'json');
  }

  /** Extends the declared operations with a fixed read-only artifact capability. */
  wrap(operations: OperationBridge): OperationBridge {
    return this.pages.wrap(operations);
  }

  /** Encodes new files losslessly; text is readable directly while binary content stays base64. */
  private addFiles(files: Record<string, string>): void {
    for (const [path, base64] of Object.entries(files)) {
      const bytes = Buffer.from(base64, 'base64');
      const text = bytes.toString('utf8');
      const textual = !bytes.includes(0) && Buffer.from(text).equals(bytes);
      this.pages.add('added:' + path, textual ? text : base64, textual ? 'utf8' : 'base64', path);
    }
  }
}
