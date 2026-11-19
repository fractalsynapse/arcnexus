import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as foundation from '../../src/index.js';
import { testInventory } from '../../src/index.js';
import { fixture, QualityFixture, selection } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} selects distinct owners and includes new maintained files`, () => {
    const tree = fixture();
    try {
      assert.equal(tree.run(operation, 'alpha').status, 0);
      const beta = tree.run(operation, 'beta');
      assert.notEqual(beta.status, 0, beta.output);
      assert.match(beta.output, /probe\.ts/);
    } finally {
      tree.close();
    }
  });

  test(`${operation} rejects overlapping ownership`, () => {
    const tree = fixture();
    try {
      tree.owner('overlap', 'packages/alpha');
      const result = tree.run(operation, 'alpha');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /owner|ownership/i);
    } finally {
      tree.close();
    }
  });

  test(`${operation} without an owner retains repository-wide coverage`, () => {
    const tree = fixture();
    try {
      const result = tree.run(operation);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /probe\.ts/);
    } finally {
      tree.close();
    }
  });

  test(`${operation} does not mutate maintained source on failure`, () => {
    const tree = fixture();
    try {
      const path = join(tree.root, 'packages/beta/probe.ts');
      const before = readFileSync(path);
      const result = tree.run(operation, 'beta');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /packages\/beta\/probe\.ts/);
      assert.deepEqual(readFileSync(path), before);
    } finally {
      tree.close();
    }
  });
}

test('Foundation exposes quality selection to applicability consumers', () => {
  assert.equal(typeof Reflect.get(foundation, 'selectQualityInputs'), 'function');
});

test('lint includes CommonJS files in its repository-wide coverage', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('packages/alpha/probe.cjs', 'const unused = 1;\n');
    const result = tree.run('lint');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /probe\.cjs/);
  } finally {
    tree.close();
  }
});

test('format retains the existing coverage instead of formatting arbitrary nested JSON', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'other');
    tree.write('other/probe.json', '{"value":1}\n');
    const result = tree.run('format:check', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('discovery excludes currently ignored generated inputs', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('.gitignore', 'packages/alpha/generated/\n');
    tree.write('packages/alpha/generated/probe.ts', 'const unused=1\n');
    const result = tree.run('lint', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('unowned maintained inputs are rejected with their path', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('packages/orphan/probe.ts', 'export const probe = 1;\n');
    const result = tree.run('lint', 'alpha');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /packages\/orphan\/probe\.ts/);
  } finally {
    tree.close();
  }
});

test('lint honors configuration ignores for owner applicability', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('eslint.config.ts', "export default [{ ignores: ['packages/alpha/**'] }];\n");
    tree.write('packages/alpha/probe.ts', 'const unused = 1;\n');
    const result = tree.run('lint', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('quality identity changes when configuration changes without changing selected files', () => {
  const tree = fixture();
  try {
    const before = tree.run('format:check', 'alpha');
    tree.write('.prettierrc.yaml', 'singleQuote: true\n');
    const after = tree.run('format:check', 'alpha');
    const identity = /sha256=([a-f0-9]+)/;
    assert.match(before.output, identity);
    assert.match(after.output, identity);
    assert.notEqual(before.output.match(identity)?.[1], after.output.match(identity)?.[1]);
  } finally {
    tree.close();
  }
});

test('quality commands preserve the owner test inventory and selection', () => {
  const all = testInventory();
  const selected = testInventory('foundation');
  assert(selected.length > 0);
  assert.deepEqual(
    selected,
    all.filter(({ owner }) => owner === 'foundation'),
  );
  const tree = fixture();
  try {
    tree.run('format:check', 'beta');
    tree.run('lint', 'beta');
    assert.deepEqual(testInventory(), all);
    assert.deepEqual(testInventory('foundation'), selected);
  } finally {
    tree.close();
  }
});

test('an owner with only JSON has an empty lint selection but a format selection', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('json-owner', 'packages/json-owner');
    tree.write('packages/json-owner/probe.json', '{"value":1}\n');
    const format = tree.run('format:check', 'json-owner');
    assert.notEqual(format.status, 0, format.output);
    assert.match(format.output, /packages\/json-owner\/probe\.json/);
    const lint = tree.run('lint', 'json-owner');
    assert.equal(lint.status, 0, lint.output);
    assert.match(
      lint.output,
      /lint.*(empty|no applicable|inapplicable)|(empty|no applicable|inapplicable).*lint/i,
    );
  } finally {
    tree.close();
  }
});

test('a Prettier-ignored TypeScript file leaves format empty but remains lint applicable', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('ignored-owner', 'packages/ignored-owner');
    tree.write('.prettierignore', 'packages/ignored-owner/probe.ts\n');
    tree.write('packages/ignored-owner/probe.ts', 'const unused = 1;\n');
    const format = tree.run('format:check', 'ignored-owner');
    assert.equal(format.status, 0, format.output);
    assert.match(
      format.output,
      /format.*(empty|no applicable|inapplicable)|(empty|no applicable|inapplicable).*format/i,
    );
    const lint = tree.run('lint', 'ignored-owner');
    assert.notEqual(lint.status, 0, lint.output);
    assert.match(lint.output, /packages\/ignored-owner\/probe\.ts/);
    assert.match(lint.output, /no-unused-vars/);
  } finally {
    tree.close();
  }
});

for (const extension of ['yaml', 'yml']) {
  test(`format selects maintained ${extension} files`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      const path = `packages/alpha/probe.${extension}`;
      tree.write(path, 'value: 1\n');
      assert((await selection(tree, 'format:check')).files.includes(path));
    } finally {
      tree.close();
    }
  });
}

test('public quality identity changes when selected source contents change', async () => {
  const tree = fixture();
  try {
    const before = await selection(tree, 'format:check');
    tree.write('packages/alpha/probe.ts', 'export const alpha = 2;\n');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('public lint identity changes when an imported configuration changes', async () => {
  const tree = fixture();
  try {
    tree.write(
      'eslint.config.ts',
      "import rules from './readability-rules.ts';\nexport default [rules];\n",
    );
    tree.write('readability-rules.ts', 'export default {};\n');
    const before = await selection(tree, 'lint');
    tree.write('readability-rules.ts', 'export default { rules: {} };\n');
    const after = await selection(tree, 'lint');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

for (const extension of ['jsx', 'tsx']) {
  test(`lint discovers configuration-enabled ${extension} files`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      tree.write('eslint.config.ts', `export default [{ files: ['**/*.${extension}'] }];\n`);
      const path = `packages/alpha/probe.${extension}`;
      tree.write(path, 'export const probe = 1;\n');
      assert((await selection(tree, 'lint')).files.includes(path));
    } finally {
      tree.close();
    }
  });
}
