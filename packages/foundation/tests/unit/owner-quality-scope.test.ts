import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as foundation from '../../src/index.js';
import { fixture, QualityFixture } from './quality-fixture.js';

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
