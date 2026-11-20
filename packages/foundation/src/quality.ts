import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { globSync, lstatSync, readFileSync } from 'node:fs';
import { matchesGlob, resolve } from 'node:path';
import { parse } from 'yaml';
import { team } from '../../team/src/index.js';

export type QualityOperation = 'format:check' | 'lint';

export interface QualityScope {
  operation: QualityOperation;
  owner?: string;
  files: string[];
}

export const qualityScopePrefix = 'ArcNexus quality selection: ';
const formatPatterns = [
  '*.{ts,json}',
  '{apps,packages,scripts,fixtures}/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,json,yaml,yml}',
];

/** Select maintained owner inputs and run read-only quality tools inside the caller's environment. */
export class Quality {
  /** Resolve all discovery and tool configuration relative to one project, independent of process cwd. */
  constructor(private readonly root: string) {}

  /** Compare actual Team decisions without evaluating executable tool configuration in the host. */
  validateOwnership(captured: readonly { id: string; owns: readonly string[] }[]) {
    const current = this.components();
    const files = this.inventory();
    for (const path of files) {
      const before = team.ownerFor(captured, path);
      const after = team.ownerFor(current, path);
      if (before.kind === 'unowned' && after.kind === 'unowned') continue;
      assert(
        before.kind === 'owned' && after.kind === 'owned' && before.owner.id === after.owner.id,
        `Quality ownership differs from captured authority: ${path}`,
      );
    }
    return new Set(files);
  }

  /** Use Git, tool applicability and Team together; unknown or conflicting ownership is an error. */
  async select(operation: string | undefined, owner?: string): Promise<QualityScope> {
    assert(
      operation === 'format:check' || operation === 'lint',
      `Unknown quality operation: ${operation}`,
    );
    const members = this.components();
    assert(!owner || members.some(({ id }) => id === owner), `Unknown quality owner: ${owner}`);
    const applicable = await this.applicable(operation);
    const files = applicable.filter((path) => {
      const resolved = team.ownerFor(members, path);
      assert(resolved.kind === 'owned', `Invalid quality ownership (${resolved.kind}): ${path}`);
      return !owner || resolved.owner.id === owner;
    });
    return { operation, owner, files };
  }

  /** Record the exact scope, then return the real tool result without rewriting maintained source. */
  async run(operation: string | undefined, owner?: string) {
    const scope = await this.select(operation, owner);
    console.log(qualityScopePrefix + JSON.stringify(scope));
    if (!scope.files.length) return 0;
    if (scope.operation === 'lint') return this.lint(scope.files);
    let failed = false;
    for (const path of scope.files) {
      if (!(await this.formatted(path))) {
        console.error(`Formatting differs: ${path}`);
        failed = true;
      }
    }
    return failed ? 1 : 0;
  }

  /** Read identities and ownership only; Team remains the canonical scope resolver. */
  private components(): { id: string; owns: string[] }[] {
    return globSync('.arc/architecture/components/*.yaml', { cwd: this.root }).map((path) =>
      parse(readFileSync(resolve(this.root, path), 'utf8')),
    );
  }

  /** Include tracked and new maintained files while leaving ignore traversal to Git and each tool. */
  private inventory() {
    const listed = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: this.root,
        encoding: 'utf8',
        maxBuffer: Infinity,
      },
    );
    return [...new Set(listed.split('\0').filter(Boolean))]
      .filter((path) => {
        try {
          return lstatSync(resolve(this.root, path)).isFile();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
          throw error;
        }
      })
      .sort();
  }

  /** Evaluate candidate tool configuration here, inside confinement for a host-initiated check. */
  private async applicable(operation: QualityOperation) {
    const files: string[] = [];
    const eslint =
      operation === 'lint' ? new (await import('eslint')).ESLint({ cwd: this.root }) : undefined;
    const prettier = operation === 'format:check' ? await import('prettier') : undefined;
    for (const path of this.inventory()) {
      if (eslint && (await eslint.isPathIgnored(resolve(this.root, path)))) continue;
      if (
        prettier &&
        (!formatPatterns.some((pattern) => matchesGlob(path, pattern)) ||
          (
            await prettier.getFileInfo(resolve(this.root, path), {
              ignorePath: resolve(this.root, '.prettierignore'),
              resolveConfig: false,
            })
          ).ignored)
      )
        continue;
      files.push(path);
    }
    return files;
  }

  /** Use the same ESLint API/configuration as the CLI and preserve diagnostic severity without quotas. */
  private async lint(files: string[]) {
    const eslint = new (await import('eslint')).ESLint({ cwd: this.root });
    const results = await eslint.lintFiles(files.map((path) => resolve(this.root, path)));
    const output = (await eslint.loadFormatter()).format(results);
    if (output) console.log(output);
    return results.some(({ errorCount }) => errorCount > 0) ? 1 : 0;
  }

  /** Ask Prettier to check the complete input with its resolved configuration and inferred parser. */
  private async formatted(path: string) {
    const prettier = await import('prettier');
    const filepath = resolve(this.root, path);
    const options = await prettier.resolveConfig(filepath);
    return prettier.check(readFileSync(filepath, 'utf8'), { ...options, filepath });
  }
}
