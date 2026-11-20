import assert from 'node:assert/strict';
import test from 'node:test';
import { OwnerQualityScenario } from '../fixtures/owner-quality.js';
import { pendingStewardCheck } from '../../src/steward-check.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['native', 'regression'],
} as const;
const native = { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' };

test(
  'confined owner formatting retains its actual scope and real failing exit without writing source',
  native,
  async (context) => {
    const scenario = new OwnerQualityScenario(context);
    scenario.write('packages/alpha/main.ts', 'export const alpha={enabled:true}\n');
    const failed = await scenario.run('format:check');
    assert.equal(failed.status, 1, scenario.read(failed.log));
    assert.match(scenario.read(failed.log), /Formatting differs: packages\/alpha\/main.ts/);
    scenario.write('packages/alpha/main.ts', 'export const alpha = { enabled: true };\n');
    const passed = await scenario.run('format:check', 'packages/alpha');
    assert.equal(passed.status, 0, scenario.read(passed.log));
    assert.deepEqual(passed.selection?.files, ['packages/alpha/main.ts']);
  },
);

test(
  'a steward without suites receives the real lint failure and other operations remain applicable',
  native,
  async (context) => {
    const scenario = new OwnerQualityScenario(context);
    scenario.write(
      'packages/alpha/main.ts',
      Array.from({ length: 501 }, () => '// line').join('\n'),
    );
    const lint = await scenario.run('lint');
    assert.equal(lint.status, 1, scenario.read(lint.log));
    assert.match(scenario.read(lint.log), /max-lines/);
    const format = await scenario.run('format:check');
    assert.notEqual(format.status, 'not-applicable');
  },
);

test(
  'confined formatting and lint record their independently empty selections',
  native,
  async (context) => {
    const scenario = new OwnerQualityScenario(context);
    scenario.write('packages/alpha/main.ts', 'export const alpha = 1;\n');
    scenario.write('packages/alpha/.gitignore', 'main.ts\n');
    scenario.write('eslint.config.mjs', "export default [{ ignores: ['packages/alpha/**'] }];\n");
    const lint = await scenario.run('lint');
    assert.equal(lint.status, 'not-applicable', scenario.read(lint.log));
    assert.deepEqual(lint.selection?.files, []);
    const format = await scenario.run('format:check');
    assert.equal(format.status, 0, scenario.read(format.log));
    assert.deepEqual(format.selection?.files, ['packages/alpha/main.ts']);
  },
);

test(
  'captured ownership drift cannot turn an empty completed check into passing evidence',
  native,
  async (context) => {
    const scenario = new OwnerQualityScenario(context);
    scenario.write('.arc/architecture/components/alpha.yaml', 'id: alpha\nowns: []\n');
    scenario.write(
      '.arc/architecture/components/beta.yaml',
      'id: beta\nowns: [packages/alpha, packages/beta]\n',
    );
    const observed = await scenario.run('format:check');
    assert.equal(observed.status, 0, 'Preserve the real command exit status');
    assert.match(observed.diagnostic ?? '', /ownership differs.*packages\/alpha/);
    const failed = pendingStewardCheck(
      [
        {
          check: observed,
          scope: {
            owner: 'alpha',
            activity: 'implementation',
            expected: 'pass',
          },
        },
      ],
      { owner: 'alpha', activity: 'implementation' },
    );
    assert.equal(failed?.diagnostic, observed.diagnostic);
    assert.equal(failed?.status, 0);
  },
);
