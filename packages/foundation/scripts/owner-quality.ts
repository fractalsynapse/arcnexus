import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { selectQualityInputs } from '../src/index.js';

type Operation = 'format:check' | 'lint';

/** Select maintained inputs by owner before invoking the configured quality tools. */
class OwnerQuality {
  /** Retain the operation and optional validated owner for one invocation. */
  constructor(
    private readonly operation: Operation,
    private readonly owner?: string,
  ) {}

  /** Resolve shared discovery, then run the matching read-only quality command. */
  async run(): Promise<void> {
    const selection = await selectQualityInputs(this.operation, this.owner);
    console.log(
      `${this.operation} scope=${this.owner ?? 'repository'} sha256=${selection.identity}`,
    );
    const files = selection.files;
    const identity = createHash('sha256');
    for (const path of files) identity.update(path).update(readFileSync(path));
    console.log(
      `${this.operation} scope=${this.owner ?? 'repository'} inputs=${files.length} sha256=${identity.digest('hex')}`,
    );
    if (!files.length) {
      console.log(`${this.operation} is empty: no applicable maintained files.`);
      return;
    }

    const executable = this.operation === 'lint' ? 'eslint' : 'prettier';
    const args =
      this.operation === 'lint'
        ? [...files, '--max-warnings', '0']
        : ['--check', '--no-error-on-unmatched-pattern', ...files];
    const result = spawnSync(executable, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}

const [operation, owner, ...extra] = process.argv.slice(2);
assert(['format:check', 'lint'].includes(operation ?? ''), 'Expected format:check or lint');
assert.equal(extra.length, 0, 'Usage: owner-quality.ts <format:check|lint> [owner]');
await new OwnerQuality(operation as Operation, owner).run();
