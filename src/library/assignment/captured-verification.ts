import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { digest } from '../architecture/assignment.js';
import { covered, type Component } from '../architecture/components.js';
import { git } from '../operations/process.js';
import { withFrozenTests, type FrozenTest } from './checkpoints.js';
import type { RecordData } from '../workspace/state.js';
import type { VerificationCheck } from '../architecture/config.js';

export interface CapturedVerificationContext {
  record: RecordData;
  component: Component;
  authorityBase: string;
  verifiedBase: string;
  checks: (checks: VerificationCheck[], stage: string) => Promise<void>;
}

/** Checks candidate implementation against verified tests and captured executable authority. */
export class CapturedVerification {
  /** Uses host-selected Git revisions outside worker-editable state. */
  constructor(private readonly context: CapturedVerificationContext) {}

  /** Reruns observed checks against captured inputs when candidate edits changed them. */
  async verify(): Promise<void> {
    const { record } = this.context;
    if (!record.generalExecution) return;
    await this.characterization();
    const inputs = this.inputs();
    if (!inputs.some((input) => this.changed(input))) return;
    await withFrozenTests(record, inputs, async () => {
      await this.context.checks(this.context.component.verification, 'captured-acceptance');
    });
  }

  /** Rechecks the original passing characterization through the same host service in both workflows. */
  private async characterization(): Promise<void> {
    const { record, component, checks } = this.context;
    if (!record.characterization) return;
    const frozen = record.frozenTests as FrozenTest[] | undefined;
    if (!frozen?.length) throw new Error('Missing captured characterization evidence');
    await withFrozenTests(record, frozen, () =>
      checks(component.verification, 'characterization-after'),
    );
  }

  /** Separates verified tests from captured commands without restoring implementation files. */
  private inputs(): FrozenTest[] {
    const { record } = this.context;
    const scope = [
      ...this.context.component.tests,
      ...((record.trustedVerificationPaths ?? []) as string[]),
    ];
    const files = new Set(
      this.context.component.verification
        .flatMap((c) => ('command' in c ? [c.command, ...c.args] : []))
        .map(normalize),
    );
    const tests = new Set((record.verifiedTestPaths ?? []) as string[]);
    const authority = this.paths(this.context.authorityBase).filter(
      (path) => files.has(path) || (!tests.has(path) && covered(path, scope)),
    );
    const baseline = tests.size
      ? this.paths(this.context.verifiedBase).filter(
          (path) =>
            tests.has(path) &&
            !files.has(path) &&
            covered(path, [...scope, ...(this.context.component.allowedWritePaths ?? [])]),
        )
      : [];
    return [
      ...authority.map((path) => this.input(this.context.authorityBase, path)),
      ...baseline.map((path) => this.input(this.context.verifiedBase, path)),
    ];
  }

  /** Lists committed files without consulting an editable checkout or branch tip. */
  private paths(revision: string): string[] {
    return git(this.context.record.source, 'ls-tree', '-r', '--name-only', revision)
      .split('\n')
      .filter(Boolean);
  }

  /** Reads the exact host-selected blob and retains its content hash. */
  private input(revision: string, path: string): FrozenTest {
    const bytes = execFileSync('git', [
      '-C',
      this.context.record.source,
      'show',
      `${revision}:${path}`,
    ]);
    return { path, content: bytes.toString('base64'), sha256: digest(bytes) };
  }

  /** Treats a deleted input as changed and retains the original through the frozen-check wrapper. */
  private changed(input: FrozenTest): boolean {
    try {
      return digest(readFileSync(join(this.context.record.workspace, input.path))) !== input.sha256;
    } catch {
      return true;
    }
  }
}
