import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { check } from '../../src/check.js';

/** Run the actual shared quality implementation inside the production Bubblewrap check boundary. */
export class OwnerQualityScenario {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-owner-quality-'));
  readonly root = join(this.directory, 'project');
  private sequence = 0;
  readonly capture: Capture;
  private readonly members = {
    alpha: { id: 'alpha', owns: ['packages/alpha'], activities: {} },
    beta: { id: 'beta', owns: ['packages/beta'], activities: {} },
    tooling: {
      id: 'tooling',
      owns: [
        'packages/foundation',
        'packages/team',
        '.arc',
        'runner.mjs',
        'package.json',
        'eslint.config.mjs',
        '.gitignore',
      ],
      activities: {},
    },
  };

  /** Install real built selector code with isolated source/configuration and shared read-only dependencies. */
  constructor(context: TestContext) {
    context.after(() => rmSync(this.directory, { recursive: true, force: true }));
    mkdirSync(this.root);
    this.git('init');
    for (const member of Object.values(this.members))
      this.write(`.arc/architecture/components/${member.id}.yaml`, JSON.stringify(member));
    this.write('packages/alpha/main.ts', 'export const alpha = 1;\n');
    this.write('packages/beta/main.ts', 'export const beta = 1;\n');
    this.write('package.json', '{"type":"module"}\n');
    this.write('.gitignore', 'node_modules/\n');
    this.installRunner();
    this.git('add', '.');
    this.capture = {
      source: { root: this.root },
      project: { checks: { acceptance: [] } },
      components: this.members,
      operations: {},
      contracts: [],
    } as unknown as Capture;
  }

  /** Write an isolated candidate/configuration input; no live project files are modified. */
  write(path: string, content: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }

  /** Read the complete actual log retained by Execution. */
  read(path: string) {
    return readFileSync(path, 'utf8');
  }

  /** Invoke a declared owner check with real installed dependencies and the captured Team. */
  run(operation: 'format:check' | 'lint', cwd = '.') {
    const id = operation === 'lint' ? 'owner-lint' : 'owner-format';
    const applicability = operation === 'lint' ? 'owner-lint-files' : 'owner-format-files';
    const capture = {
      ...this.capture,
      operations: {
        [id]: {
          id,
          category: 'lint',
          command: '/usr/bin/node',
          tool: 'check',
          network: false,
          args: [join(this.root, 'runner.mjs'), operation, { context: 'owner' as const }],
          cwd,
          applicability,
        },
      },
    } as Capture;
    return check(
      capture,
      this.root,
      join(this.root, '.git'),
      id,
      'alpha',
      join(this.directory, `check-${++this.sequence}.log`),
      new AbortController().signal,
      join(process.cwd(), 'node_modules'),
    );
  }

  /** Copy real compiled modules instead of replacing selector behavior with an echo/fake operation. */
  private installRunner() {
    for (const path of ['packages/foundation/src/quality.js', 'packages/team/src/index.js']) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      copyFileSync(join(process.cwd(), 'dist', path), join(this.root, path));
    }
    this.write(
      'runner.mjs',
      `import { Quality } from './packages/foundation/src/quality.js';\nprocess.exitCode = await new Quality(${JSON.stringify(this.root)}).run(...process.argv.slice(2));\n`,
    );
    this.write(
      'eslint.config.mjs',
      "export default [{ files: ['**/*.ts'], rules: { 'max-lines': ['error', 500] } }];\n",
    );
  }

  /** Use real Git discovery and nested ignore semantics in the confined project. */
  private git(...args: string[]) {
    return execFileSync('git', args, { cwd: this.root, encoding: 'utf8', stdio: 'pipe' });
  }
}
