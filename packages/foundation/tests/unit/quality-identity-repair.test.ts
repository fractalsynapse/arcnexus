import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, selection } from './quality-fixture.js';

test('lint identity follows imports relative to each configuration helper', async () => {
  const tree = fixture();
  try {
    tree.owner('config-owner', 'config');
    tree.write('eslint.config.ts', "import rules from './config/helper.js';\nexport default [rules];\n");
    tree.write('config/helper.js', "import nested from './nested.js'; export default nested;\n");
    tree.write('config/nested.js', 'export default {};\n');
    const before = await selection(tree, 'lint');
    tree.write('config/nested.js', 'export default { rules: {} };\n');
    const after = await selection(tree, 'lint');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('format identity includes the applicable nested Prettier configuration', async () => {
  const tree = fixture();
  try {
    tree.write('packages/alpha/.prettierrc.yaml', 'singleQuote: true\n');
    const before = await selection(tree, 'format:check');
    tree.write('packages/alpha/.prettierrc.yaml', 'singleQuote: false\n');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('identity distinguishes empty optional inputs from literal missing', async () => {
  const tree = fixture();
  try {
    tree.write('.eslintignore', '');
    const before = await selection(tree, 'format:check');
    tree.write('.eslintignore', 'missing');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('identity excludes ignore files in ignored generated directories', async () => {
  const tree = fixture();
  try {
    tree.write('.gitignore', 'packages/alpha/generated/\n');
    tree.write('packages/alpha/generated/.gitignore', '# first\n');
    const before = await selection(tree, 'format:check');
    tree.write('packages/alpha/generated/.gitignore', '# second\n');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.equal(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} ignores unescaped trailing whitespace in ignore rules`, async () => {
    const tree = fixture();
    try {
      tree.write('packages/alpha/.gitignore', 'hidden.ts   \n');
      tree.write('packages/alpha/hidden.ts', 'export const hidden = 1;\n');
      const result = await selection(tree, operation);
      assert(!result.files.includes('packages/alpha/hidden.ts'));
      assert(result.files.includes('packages/alpha/probe.ts'));
    } finally {
      tree.close();
    }
  });

  test(`${operation} treats escaped wildcard characters as literals`, async () => {
    const tree = fixture();
    try {
      tree.write('packages/alpha/.gitignore', 'probe\\?.ts\n');
      tree.write('packages/alpha/probe?.ts', 'export const hidden = 1;\n');
      tree.write('packages/alpha/probe1.ts', 'export const visible = 1;\n');
      const result = await selection(tree, operation);
      assert(!result.files.includes('packages/alpha/probe?.ts'));
      assert(result.files.includes('packages/alpha/probe1.ts'));
    } finally {
      tree.close();
    }
  });
}
