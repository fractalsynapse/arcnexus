import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectQualityInputs } from '../../src/index.js';
import { fixture } from './quality-fixture.js';

interface Eligibility {
  eligible: boolean;
  reason?: string;
}

function eligibility(result: unknown): Eligibility | undefined {
  return (result as { reuseEligibility?: Eligibility }).reuseEligibility;
}

test('executable formatter configuration with an unselected helper declines reuse', async () => {
  const tree = fixture();
  try {
    tree.write('packages/alpha/prettier.config.cjs', "module.exports = require('../../settings.cjs');\n");
    tree.write('settings.cjs', 'module.exports = { singleQuote: true };\n');
    const result = await selectQualityInputs('format:check', 'alpha', tree.root);
    assert(result.files.includes('packages/alpha/probe.ts'));
    const reuse = eligibility(result);
    assert.equal(reuse?.eligible, false);
    assert.match(reuse?.reason ?? '', /prettier\.config\.cjs/i);
  } finally {
    tree.close();
  }
});

for (const [form, source, reason] of [
  ['require', "const rules = require('./helper.cjs'); export default [rules];\n", /require/i],
  ['dynamic import', "const rules = await import('./helper.js'); export default [rules.default];\n", /dynamic|import/i],
  ['re-export', "export { default } from './helper.js';\n", /re.export/i],
] as const) {
  test(`lint ${form} dependency declines reuse with a reason`, async () => {
    const tree = fixture();
    try {
      tree.owner('helper-js', 'helper.js');
      tree.owner('helper-cjs', 'helper.cjs');
      tree.write('eslint.config.ts', source);
      tree.write('helper.cjs', 'module.exports = {};\n');
      tree.write('helper.js', 'export default {};\n');
      const result = await selectQualityInputs('lint', 'alpha', tree.root);
      const reuse = eligibility(result);
      assert.equal(reuse?.eligible, false);
      assert.match(reuse?.reason ?? '', reason);
    } finally {
      tree.close();
    }
  });
}

test('lint rejects unsupported dependencies in a statically imported helper', async () => {
  const tree = fixture();
  try {
    tree.write(
      'eslint.config.ts',
      "import rules from './packages/foundation/rules.js'; export default [rules];\n",
    );
    tree.write(
      'packages/foundation/rules.js',
      "const load = () => require('./untracked.cjs'); export default {};\n",
    );
    const result = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /rules\.js.*require/i);
  } finally {
    tree.close();
  }
});

test('declarative formatter plugin configuration declines reuse', async () => {
  const tree = fixture();
  try {
    tree.write('packages/alpha/.prettierrc.json', '{"plugins":["prettier/plugins/typescript"]}');
    const result = await selectQualityInputs('format:check', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /plugin.*prettierrc/i);
  } finally {
    tree.close();
  }
});

for (const [form, source, reason] of [
  ['filesystem import', "import type { Stats } from 'node:fs'; export default [];\n", /filesystem/i],
  ['bare package import', "import type plugin from 'eslint-plugin-example'; export default [];\n", /bare package/i],
  ['export star', "export * from './packages/alpha/helper.js';\n", /export.star/i],
] as const) {
  test(`lint ${form} declines reuse with a precise reason`, async () => {
    const tree = fixture();
    try {
      tree.write('eslint.config.ts', source);
      if (form === 'export star') tree.write('packages/alpha/helper.js', '');
      const result = await selectQualityInputs('lint', 'alpha', tree.root);
      assert.equal(eligibility(result)?.eligible, false);
      assert.match(eligibility(result)?.reason ?? '', reason);
    } finally {
      tree.close();
    }
  });
}

test('lint side-effect imports decline reuse even when their path is local', async () => {
  const tree = fixture();
  try {
    tree.write('eslint.config.ts', "import './packages/foundation/rules.js'; export default [];\n");
    tree.write('packages/foundation/rules.js', 'export default {};\n');
    const result = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /eslint\.config\.ts.*static subset/i);
  } finally {
    tree.close();
  }
});

test('nested package formatter plugins decline reuse', async () => {
  const tree = fixture();
  try {
    tree.write(
      'package.json',
      '{"prettier":{"overrides":[{"files":["**/*.ts"],"options":{"plugins":["prettier/plugins/typescript"]}}]}}',
    );
    const result = await selectQualityInputs('format:check', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /plugin.*package\.json/i);
  } finally {
    tree.close();
  }
});

test('commented lint imports retain helper identity coverage', async () => {
  const tree = fixture();
  try {
    tree.owner('helper-js', 'helper.js');
    tree.write(
      'eslint.config.ts',
      "import rules from /* comment */ './helper.js'; export default [rules];\n",
    );
    tree.write('helper.js', 'export default {};\n');
    const before = await selectQualityInputs('lint', 'alpha', tree.root);
    assert(before.identity);
    tree.write('helper.js', 'export default { changed: true };\n');
    const changed = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.notEqual(changed.identity, before.identity);
    assert.equal(eligibility(changed)?.eligible, true);
  } finally {
    tree.close();
  }
});

for (const extension of ['mts', 'cts'] as const) {
  test(`uncovered executable formatter .${extension} configuration declines reuse`, async () => {
    const tree = fixture();
    try {
      tree.write(`packages/alpha/prettier.config.${extension}`, 'export default {};\\n');
      const result = await selectQualityInputs('format:check', 'alpha', tree.root);
      assert.equal(eligibility(result)?.eligible, false);
      assert.match(eligibility(result)?.reason ?? '', new RegExp(`prettier\\.config\\.${extension}`));
    } finally {
      tree.close();
    }
  });
}

test('explicit lint imports do not fall back to a different extension', async () => {
  const tree = fixture();
  try {
    tree.owner('helper-ts', 'helper.ts');
    tree.write('eslint.config.ts', "import rules from './helper.js'; export default [rules];\n");
    tree.write('helper.ts', 'export default {};\n');
    const result = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /coverage is incomplete at helper\.js/i);
  } finally {
    tree.close();
  }
});

test('extensionless lint imports decline reuse when runtime resolution is ambiguous', async () => {
  const tree = fixture();
  try {
    tree.owner('helper-ts', 'helper.ts');
    tree.owner('helper-js', 'helper.js');
    tree.write('eslint.config.ts', "import rules from './helper'; export default [rules];\n");
    tree.write('helper.ts', 'export default {};\n');
    tree.write('helper.js', 'export default {};\n');
    const result = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, false);
    assert.match(eligibility(result)?.reason ?? '', /extensionless.*helper/i);
  } finally {
    tree.close();
  }
});

test('known static configuration preserves scoped reuse and identity', async () => {
  const tree = fixture();
  try {
    tree.owner('helper-js', 'helper.js');
    tree.write('eslint.config.ts', "import rules from './helper.js'; export default [rules];\n");
    tree.write('helper.js', 'export default {};\n');
    const before = await selectQualityInputs('lint', 'alpha', tree.root);
    tree.write('packages/beta/probe.ts', 'export const unrelated = 2;\n');
    const after = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.equal(eligibility(before)?.eligible, true);
    assert.deepEqual(after.files, before.files);
    assert.equal(after.identity, before.identity);
    assert.deepEqual(eligibility(after), eligibility(before));
    tree.write('helper.js', 'export default { rules: {} };\n');
    const changed = await selectQualityInputs('lint', 'alpha', tree.root);
    assert.notEqual(changed.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('declarative formatter configuration remains eligible and command selection agrees', async () => {
  const tree = fixture();
  try {
    const result = await selectQualityInputs('format:check', 'alpha', tree.root);
    assert.equal(eligibility(result)?.eligible, true);
    assert.deepEqual(result.files, ['packages/alpha/probe.ts']);
    const command = tree.run('format:check', 'alpha');
    assert.equal(command.status, 0, command.output);
    assert.match(command.output, new RegExp(result.identity));
  } finally {
    tree.close();
  }
});
