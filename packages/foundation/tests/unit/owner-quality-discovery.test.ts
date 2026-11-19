import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as foundation from '../../src/index.js';
import { QualityFixture } from './quality-fixture.js';

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
