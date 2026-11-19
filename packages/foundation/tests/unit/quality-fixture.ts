import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as foundation from '../../src/index.js';

export type Operation = 'format:check' | 'lint';

/** Isolate command inputs while using the repository's actual tooling and configuration. */
export class QualityFixture {
  readonly root: string;

  /** Copy tool inputs into a declared generated root and share installed dependencies. */
  constructor() {
    mkdirSync('.test-build', { recursive: true });
    this.root = mkdtempSync(resolve('.test-build/quality-'));
    for (const path of [
      'package.json',
      '.prettierignore',
      '.prettierrc.yaml',
      'eslint.config.ts',
      'packages/foundation/scripts',
      'packages/foundation/src',
      'packages/team/src',
    ]) {
      mkdirSync(join(this.root, path, '..'), { recursive: true });
      cpSync(path, join(this.root, path), { recursive: true });
    }
    symlinkSync(resolve('node_modules'), join(this.root, 'node_modules'), 'dir');
    mkdirSync(join(this.root, '.arc/architecture/components'), { recursive: true });
    this.write(
      '.arc/architecture/components/tooling.yaml',
      'id: tooling\nowns:\n- package.json\n- .prettierignore\n- .prettierrc.yaml\n- eslint.config.ts\n- packages/foundation\n- packages/team\n',
    );
  }

  /** Define a synthetic owner without changing the captured repository catalog. */
  owner(id: string, path: string) {
    this.write(`.arc/architecture/components/${id}.yaml`, `id: ${id}\nowns:\n- ${path}\n`);
  }

  /** Create an input in the isolated task tree. */
  write(path: string, content: string) {
    const target = join(this.root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }

  /** Invoke the public command and retain its exit and diagnostics. */
  run(operation: Operation, owner?: string) {
    const args = ['run', operation, ...(owner ? ['--', owner] : [])];
    const result = spawnSync('npm', args, { cwd: this.root, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    return { status: result.status, output: result.stdout + result.stderr };
  }

  /** Remove generated fixture inputs after the test. */
  close() {
    rmSync(this.root, { recursive: true, force: true });
  }
}

/** Provide independent owners whose newly created files differ in quality. */
export function fixture() {
  const tree = new QualityFixture();
  tree.owner('alpha', 'packages/alpha');
  tree.owner('beta', 'packages/beta');
  tree.write('packages/alpha/probe.ts', 'export const alpha = 1;\n');
  tree.write('packages/beta/probe.ts', 'const unused=1\n');
  return tree;
}

/** Read public applicability in the isolated worktree. */
export async function selection(
  tree: QualityFixture,
  operation: Operation,
  owner: string | undefined = 'alpha',
) {
  const previous = process.cwd();
  try {
    process.chdir(tree.root);
    return await foundation.selectQualityInputs(
      operation,
      owner === 'repository' ? undefined : owner,
    );
  } finally {
    process.chdir(previous);
  }
}
