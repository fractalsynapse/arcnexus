import { frozenReview, type FrozenTest } from '../assignment/checkpoints.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidateDigest, captureChanges } from '../change-inspection/changes.js';
import type { OperationBridge } from '../operations/operations.js';
import { EvidencePages, ExecutionEvidence } from '../report/report.js';
import type { RecordData } from '../workspace/state.js';

/** Pins host-observed changes and exposes only their retained artifacts to independent reviewers. */
export class VerificationEvidence {
  private readonly pages = new EvidencePages('verification.evidence');

  readonly candidate: string;

  /** Captures complete change evidence outside the editable candidate and rejects concurrent changes. */
  constructor(root: string, record: RecordData, baseline: string, input?: unknown) {
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
    ExecutionEvidence.pin(root, record.executionRunId, this.pages, record.hostExecutionEvidence);
    this.regressions(record);
    this.pages.add('assessment', JSON.stringify(input ?? null), 'json');
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

  /** Exposes original worker tests and observed failure for review without executing them as authority. */
  private regressions(record: RecordData): void {
    const tests = (record.frozenTests ?? []) as FrozenTest[];
    if (!tests.length) return;
    const comparison = frozenReview(record, tests);
    for (const test of tests)
      this.pages.add('regression:' + test.path, test.content, 'base64', test.path);
    this.pages.add(
      'regressions',
      JSON.stringify({ ...comparison, expectedFailure: record.regressionCheckpoint }),
      'json',
    );
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
