import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { parse } from 'yaml';
import { team } from '../../team/src/index.js';

type Operation = 'format:check' | 'lint';
interface Component { id: string; owns: string[]; }

/** Select current maintained inputs by captured ownership before invoking quality tools. */
class OwnerQuality {
  private readonly operation: Operation;
  private readonly owner?: string;

  /** Retain the operation and optional validated owner for one invocation. */
  constructor(operation: Operation, owner?: string) {
    this.operation = operation;
    this.owner = owner;
  }

  /** Validate ownership, identify current files and invoke the configured read-only tool. */
  run(): void {
    const components = globSync('.arc/architecture/components/*.yaml').map((path) =>
      parse(readFileSync(path, 'utf8')) as Component,
    );
    assert(!this.owner || components.some(({ id }) => id === this.owner), `Unknown owner: ${this.owner}`);
    const paths = this.currentFiles().filter((path) =>
      !this.owner || team.ownerFor(components, path).kind === 'owned' &&
        team.ownerFor(components, path).owner.id === this.owner,
    );
    const files = this.applicableFiles(paths);
    const identity = createHash('sha256').update(files.join('\n')).digest('hex');
    console.log(`${this.operation} scope=${this.owner ?? 'repository'} inputs=${files.length} sha256=${identity}`);
    if (!files.length) {
      console.log(`${this.operation} is empty: no applicable maintained files.`);
      return;
    }
    const executable = this.operation === 'lint' ? 'eslint' : 'prettier';
    const args = this.operation === 'lint'
      ? [...files, '--max-warnings', '0']
      : ['--check', '--no-error-on-unmatched-pattern', ...files];
    const result = spawnSync(executable, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }

  /** Include tracked and newly created nonignored maintained files in stable order. */
  private currentFiles(): string[] {
    const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
    const created = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
    return [...new Set([...tracked, ...created].split('\0').filter((path) =>
      /\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx|json|yaml|yml)$/.test(path),
    ))].sort();
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
