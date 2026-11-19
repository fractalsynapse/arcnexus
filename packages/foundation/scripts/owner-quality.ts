import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { parse } from 'yaml';
import { selectQualityInputs } from '../src/index.js';

type Operation = 'format:check' | 'lint';
interface Component {
  id: string;
  owns: string[];
}

/** Select current maintained inputs by captured ownership before invoking quality tools. */
class OwnerQuality {
  private readonly operation: Operation;
  private readonly owner?: string;

  /** Retain the operation and optional validated owner for one invocation. */
  constructor(operation: Operation, owner?: string) {
    this.operation = operation;
    this.owner = owner;
  }

  /** Validate ownership and delegate execution for the selected maintained inputs. */
  run(): void {
    const files = this.selectFiles();
    this.execute(files);
  }

  /** Resolve validated ownership and operation applicability from the current catalog. */
  private selectFiles(): string[] {
    const components = globSync('.arc/architecture/components/*.yaml').map(
      (path) => parse(readFileSync(path, 'utf8')) as Component,
    );
    assert(
      !this.owner || components.some(({ id }) => id === this.owner),
      `Unknown owner: ${this.owner}`,
    );
    const paths = this.currentFiles().filter((path) => {
      const resolution = team.ownerFor(components, path);
      assert.notEqual(resolution.kind, 'collision', `Ambiguous ownership: ${path}`);
      return !this.owner || (resolution.kind === 'owned' && resolution.owner.id === this.owner);
    });
    return this.applicableFiles(paths);
  }

  /** Report input identity, then run the configured read-only quality command. */
  private execute(files: readonly string[]): void {
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

  /** Include current maintained files while excluding generated and dependency trees. */
  private currentFiles(): string[] {
    const paths = globSync('**/*.{ts,mts,cts,js,mjs,cjs,jsx,tsx,json,yaml,yml}');
    return paths
      .filter(
        (path) =>
          !/(^|\/)(?:node_modules|dist|\.git|\.test-build|\.fixture-build|context|examples|\.audit-work)(\/|$)/.test(
            path,
          ),
      )
      .sort();
  }

  /** Apply each tool's own ignore and file applicability rules before command execution. */
  private applicableFiles(paths: readonly string[]): string[] {
    return paths.filter((path) => {
      if (this.operation === 'lint' && !/\.(?:ts|mts|cts|js|mjs)$/.test(path)) return false;
      if (this.operation === 'format:check') {
        const result = spawnSync('prettier', ['--file-info', path], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout).ignored === false;
      }
      return true;
    });
  }
}

const [operation, owner, ...extra] = process.argv.slice(2);
assert(['format:check', 'lint'].includes(operation ?? ''), 'Expected format:check or lint');
assert.equal(extra.length, 0, 'Usage: owner-quality.ts <format:check|lint> [owner]');
new OwnerQuality(operation as Operation, owner).run();
