import assert from 'node:assert/strict';
import { cpSync, globSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { hasOwnerTestSuites, selectQualityInputs } from '../../../foundation/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { StewardFixture } from '../fixtures/steward.js';

test(
  'real lint and type failures reach the same caller for an owner without suites',
  async (t) => {
    const source = process.cwd();
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-quality-real-'));
    const workspace = join(root, 'workspace');
    cpSync(source, workspace, {
      recursive: true,
      filter: (path) => !['.git', 'node_modules', 'dist'].includes(relative(source, path).split('/')[0]!),
    });
    const task = new StewardFixture(t, root).task;
    task.worktree = workspace;
    const components = Object.fromEntries(
      globSync('.arc/architecture/components/*.yaml').map((path) => {
        const component = parse(readFileSync(path, 'utf8')) as { id: string; owns: string[] };
        return [component.id, component];
      }),
    );
    let owner = '';
    let file = '';
    for (const candidate of Object.keys(components)) {
      const selected = await selectQualityInputs('lint', candidate);
      const typescript = selected.files.find((path) => path.endsWith('.ts'));
      if (typescript && !hasOwnerTestSuites(source, candidate, Object.values(components))) {
        owner = candidate;
        file = typescript;
        break;
      }
    }
    assert.ok(owner && file, 'fixture needs a lintable owner without suites');
    const path = join(workspace, file);
    const original = readFileSync(path, 'utf8');
    const longFunction = Array.from({ length: 35 }, () => '  value += 1;').join('\n');
    writeFileSync(path, original + `\nfunction qualityFailure(): number {\n  let value: number = "wrong";\n${longFunction}\n  return value;\n}\nqualityFailure();\n`);
    Object.assign(task.capture, {
      source: { ...task.capture.source, root: source },
      components,
      project: { ...task.capture.project, checks: { acceptance: [] } },
      operations: {
        'owner-tests': { id: 'owner-tests', category: 'integration-test', command: 'npm',
          args: ['test', '--', { context: 'owner' }], cwd: '.', network: false,
          applicability: 'owner-test-suites' },
        'owner-lint': { id: 'owner-lint', category: 'build', command: 'npm',
          args: ['run', 'lint', '--', { context: 'owner' }], cwd: '.', network: false },
        'repository-types': { id: 'repository-types', category: 'build', command: 'npm',
          args: ['run', 'check'], cwd: '.', network: false },
      },
    });
    t.after(() => task.close());
    const activation = new ActivationTools(task, { component: owner, activity: 'implementation' }, {
      goal: 'quality', assignment: {}, milestone: { id: 'quality' }, acceptance: [], worktree: workspace,
    }, AbortSignal.timeout(120_000));
    const invoke = (name: string) => activation.invoke({ name, handler: 'check' }, { expected: 'pass' });
    const suites = await invoke('owner-tests') as { status: unknown };
    assert.equal(suites.status, 'not-applicable');
    const lint = await invoke('owner-lint') as { status: unknown; log: string };
    assert.notEqual(lint.status, 0);
    assert.match(readFileSync(lint.log, 'utf8'), /max-lines-per-function|too many lines/i);
    const types = await invoke('repository-types') as { status: unknown; log: string };
    assert.notEqual(types.status, 0);
    assert.match(readFileSync(types.log, 'utf8'), /TS2322/);
  },
);
