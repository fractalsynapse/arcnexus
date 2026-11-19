import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, QualityFixture, selection } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} rejects an explicitly empty owner`, async () => {
    const tree = fixture();
    try {
      await assert.rejects(selection(tree, operation, ''), /unknown owner/i);
    } finally {
      tree.close();
    }
  });

  for (const [name, pattern] of [
    ['#hidden.ts', '\\#hidden.ts\n'],
    ['!hidden.ts', '\\!hidden.ts\n'],
    [' spaced.ts', ' spaced.ts\n'],
  ] as const) {
    test(`${operation} honors the literal ignore pattern for ${name}`, async () => {
      const tree = fixture();
      try {
        const path = `packages/alpha/${name}`;
        tree.write('packages/alpha/.gitignore', pattern);
        tree.write(path, 'export const hidden = 1;\n');
        assert(!(await selection(tree, operation)).files.includes(path));
      } finally {
        tree.close();
      }
    });
  }
}

test('identity tracks a nested ignore edit even when selected paths stay unchanged', async () => {
  const tree = fixture();
  try {
    tree.write('packages/alpha/.gitignore', '# first\n');
    const before = await selection(tree, 'format:check');
    tree.write('packages/alpha/.gitignore', '# second\n');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('identity tracks a non-TypeScript configuration dependency', async () => {
  const tree = fixture();
  try {
    tree.write('eslint.config.ts', "import rules from './rules.json' with { type: 'json' };\nexport default [rules];\n");
    tree.write('rules.json', '{"rules":{}}\n');
    const before = await selection(tree, 'lint');
    tree.write('rules.json', '{"rules":{"semi":"error"}}\n');
    const after = await selection(tree, 'lint');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

for (const path of ['packages/beta/probe.ts', 'dist/generated.ts']) {
  test(`identity ignores unrelated changes to ${path}`, async () => {
    const tree = fixture();
    try {
      tree.write(path, 'export const before = 1;\n');
      const before = await selection(tree, 'format:check');
      tree.write(path, 'export const after = 2;\n');
      const after = await selection(tree, 'format:check');
      assert.deepEqual(after.files, before.files);
      assert.equal(after.identity, before.identity);
    } finally {
      tree.close();
    }
  });
}

test('lint discovers an extension enabled by ESLint configuration', async () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('eslint.config.ts', "export default [{ files: ['**/*.custom'] }];\n");
    tree.write('packages/alpha/probe.custom', 'const value = 1;\n');
    assert((await selection(tree, 'lint')).files.includes('packages/alpha/probe.custom'));
  } finally {
    tree.close();
  }
});
