import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import * as foundation from '../../src/index.js';

export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const;

/** Exercise public selection against real Git ignore rules and real formatter/linter configuration. */
class QualityScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-quality-'));

  /** Give generic owners a real repository, including a tracked file ignored only after admission. */
  constructor(context: TestContext) {
    context.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.git('init');
    this.write('.arc/architecture/components/alpha.yaml', 'id: alpha\nowns: [packages/alpha]\n');
    this.write('.arc/architecture/components/beta.yaml', 'id: beta\nowns: [packages/beta]\n');
    this.write(
      '.arc/architecture/components/tooling.yaml',
      'id: tooling\nowns: [eslint.config.mjs]\n',
    );
    this.write('packages/alpha/src/main.ts', 'export const alpha = 1;\n');
    this.write('packages/beta/src/main.ts', 'export const beta = 1;\n');
    this.write('packages/alpha/ignored.ts', 'export const ignored = 1;\n');
    this.git('add', '.');
    this.write('.gitignore', 'packages/alpha/generated/\n');
    this.write('.prettierignore', '**/ignored.ts\n');
    this.write(
      'eslint.config.mjs',
      "export default [{ ignores: ['**/ignored.ts'] }, { files: ['**/*.ts'], rules: {} }];\n",
    );
  }

  /** Construct the supported class only after the missing capability is observed as a regression. */
  quality() {
    const Quality = (foundation as any).Quality;
    assert(Quality, 'Foundation must expose the shared owner-scoped quality path');
    return new Quality(this.root);
  }

  /** Create maintained inputs without invoking the product or changing live files. */
  write(path: string, content: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }

  /** Use Git's actual ignore and tracked-file semantics in an isolated fixture. */
  git(...args: string[]) {
    return execFileSync('git', args, { cwd: this.root, encoding: 'utf8', stdio: 'pipe' });
  }
}

for (const operation of ['format:check', 'lint']) {
  test(`${operation} selects only owned applicable files, including new untracked inputs`, async (context) => {
    const scenario = new QualityScenario(context);
    scenario.write('packages/alpha/src/new.ts', 'export const added = true;\n');
    scenario.write('packages/alpha/generated/output.ts', 'generated\n');
    const quality = scenario.quality();
    assert.deepEqual((await quality.select(operation, 'alpha')).files, [
      'packages/alpha/src/main.ts',
      'packages/alpha/src/new.ts',
    ]);
    assert.deepEqual((await quality.select(operation, 'beta')).files, [
      'packages/beta/src/main.ts',
    ]);
    assert.deepEqual((await quality.select(operation)).files, [
      ...(operation === 'lint' ? ['eslint.config.mjs'] : []),
      'packages/alpha/src/main.ts',
      'packages/alpha/src/new.ts',
      'packages/beta/src/main.ts',
    ]);
  });

  test(`${operation} rejects unknown owners and overlapping ownership`, async (context) => {
    const scenario = new QualityScenario(context);
    const quality = scenario.quality();
    await assert.rejects(quality.select(operation, 'unknown'), /Unknown.*owner/);
    scenario.write('.arc/architecture/components/beta.yaml', 'id: beta\nowns: [packages]\n');
    await assert.rejects(quality.select(operation, 'alpha'), /ownership.*packages\/alpha/i);
  });
}

test('format and lint determine applicability independently without requiring a test suite', async (context) => {
  const scenario = new QualityScenario(context);
  scenario.write('.arc/architecture/components/data.yaml', 'id: data\nowns: [packages/data]\n');
  scenario.write('packages/data/settings.json', '{"enabled":true}\n');
  const quality = scenario.quality();
  assert.deepEqual((await quality.select('format:check', 'data')).files, [
    'packages/data/settings.json',
  ]);
  assert.deepEqual((await quality.select('lint', 'data')).files, []);
});

test('shared quality execution reports a real formatting defect and leaves source untouched', async (context) => {
  const scenario = new QualityScenario(context);
  const input = 'export const alpha={enabled:true}\n';
  scenario.write('packages/alpha/src/main.ts', input);
  const quality = scenario.quality();
  assert.equal(await quality.run('format:check', 'alpha'), 1);
  assert.equal(readFileSync(join(scenario.root, 'packages/alpha/src/main.ts'), 'utf8'), input);
  scenario.write('packages/alpha/src/main.ts', 'export const alpha = { enabled: true };\n');
  assert.equal(await quality.run('format:check', 'alpha'), 0);
});

test('an owner lint selection does not evaluate another plugin configuration', async (context) => {
  const scenario = new QualityScenario(context);
  scenario.write(
    'packages/beta/eslint.config.mjs',
    "throw new Error('Foreign plugin configuration evaluated');\nexport default [];\n",
  );
  const selected = await scenario.quality().select('lint', 'alpha');
  assert.deepEqual(selected.files, ['packages/alpha/src/main.ts']);
});

test('formatting includes owned web styles and templates', async (context) => {
  const scenario = new QualityScenario(context);
  scenario.write('packages/alpha/src/shell.css', 'header{color:red}\n');
  scenario.write('packages/alpha/src/shell.html', '<header>Frame</header>\n');
  const quality = scenario.quality();
  assert.deepEqual((await quality.select('format:check', 'alpha')).files, [
    'packages/alpha/src/main.ts',
    'packages/alpha/src/shell.css',
    'packages/alpha/src/shell.html',
  ]);
});
