import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { digest } from '../architecture/assignment.js';
import { covered } from '../architecture/components.js';
import { git } from '../operations/process.js';
import { withFrozenTests, type FrozenTest } from './checkpoints.js';
import type { SessionState } from './session-state.js';

/** Checks candidate implementation against verified tests and captured executable authority. */
export class CapturedVerification {
  /** Uses host-selected Git revisions outside worker-editable state. */
  constructor(private readonly state: SessionState) {}

  /** Reruns observed checks against captured inputs when candidate edits changed them. */
  async verify(): Promise<void> {
    const { record } = this.state.options;
    if (!record.generalExecution) return;
    const inputs = this.inputs();
    if (!inputs.some((input) => this.changed(input))) return;
    await withFrozenTests(record, inputs, async () => {
      await this.state.checks(this.state.component.verification, 'captured-acceptance');
    });
    this.state.safe();
  }

  /** Separates verified tests from captured commands without restoring implementation files. */
  private inputs(): FrozenTest[] {
    const { record } = this.state.options;
    const scope = [
      ...this.state.component.tests,
      ...((record.trustedVerificationPaths ?? []) as string[]),
    ];
    const files = new Set(
      this.state.component.verification
        .flatMap((c) => ('command' in c ? [c.command, ...c.args] : []))
        .map(normalize),
    );
    const tests = new Set((record.verifiedTestPaths ?? []) as string[]);
    const authority = this.paths(this.state.resolved.base).filter(
      (path) => files.has(path) || (!tests.has(path) && covered(path, scope)),
    );
    const baseline = tests.size
      ? this.paths(record.base).filter(
          (path) =>
            tests.has(path) &&
            !files.has(path) &&
            covered(path, [...scope, ...(this.state.component.allowedWritePaths ?? [])]),
        )
      : [];
    return [
      ...authority.map((path) => this.input(this.state.resolved.base, path)),
      ...baseline.map((path) => this.input(record.base, path)),
    ];
  }

  /** Lists committed files without consulting an editable checkout or branch tip. */
  private paths(revision: string): string[] {
    return git(this.state.options.record.source, 'ls-tree', '-r', '--name-only', revision)
      .split('\n')
      .filter(Boolean);
  }

  /** Reads the exact host-selected blob and retains its content hash. */
  private input(revision: string, path: string): FrozenTest {
    const bytes = execFileSync('git', [
      '-C',
      this.state.options.record.source,
      'show',
      `${revision}:${path}`,
    ]);
    return { path, content: bytes.toString('base64'), sha256: digest(bytes) };
  }

  /** Treats a deleted input as changed and retains the original through the frozen-check wrapper. */
  private changed(input: FrozenTest): boolean {
    try {
      return (
        digest(readFileSync(join(this.state.options.record.workspace, input.path))) !== input.sha256
      );
    } catch {
      return true;
    }
  }
}
