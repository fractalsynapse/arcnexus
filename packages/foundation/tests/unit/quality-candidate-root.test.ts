import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectQualityInputs } from '../../src/index.js';
import { fixture, QualityFixture, selection } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} selects and identifies inputs from the explicit candidate root`, async () => {
    const tree = fixture();
    try {
      const expected = await selection(tree, operation);
      const actual = await Reflect.apply(selectQualityInputs, undefined, [operation, 'alpha', tree.root]);
      assert.deepEqual(actual, expected);
      tree.write('packages/alpha/probe.ts', 'export const alpha = 2;\n');
      const changed = await Reflect.apply(selectQualityInputs, undefined, [operation, 'alpha', tree.root]);
      assert.deepEqual(changed.files, expected.files);
      assert.notEqual(changed.identity, expected.identity);
    } finally {
      tree.close();
    }
  });
}

test('candidate format and lint have independently empty selections', async () => {
  const tree = new QualityFixture();
  try {
    tree.owner('json-owner', 'packages/json-owner');
    tree.owner('ignored-owner', 'packages/ignored-owner');
    tree.write('packages/json-owner/probe.json', '{"value": 1}\n');
    tree.write('packages/ignored-owner/probe.ts', 'export const value = 1;\n');
    tree.write('.prettierignore', 'packages/ignored-owner/probe.ts\n');
    const select = (operation: string, owner: string) =>
      Reflect.apply(selectQualityInputs, undefined, [operation, owner, tree.root]);
    assert.deepEqual((await select('lint', 'json-owner')).files, []);
    assert.deepEqual((await select('format:check', 'json-owner')).files, ['packages/json-owner/probe.json']);
    assert.deepEqual((await select('format:check', 'ignored-owner')).files, []);
    assert.deepEqual((await select('lint', 'ignored-owner')).files, ['packages/ignored-owner/probe.ts']);
  } finally {
    tree.close();
  }
});

test('candidate configuration changes the corresponding selection identity', async () => {
  const tree = fixture();
  try {
    for (const [operation, path, content] of [
      ['format:check', '.prettierrc.yaml', 'singleQuote: true\n'],
      ['lint', 'eslint.config.ts', 'export default [];\n'],
    ] as const) {
      const before = await Reflect.apply(selectQualityInputs, undefined, [operation, 'alpha', tree.root]);
      tree.write(path, content);
      const after = await Reflect.apply(selectQualityInputs, undefined, [operation, 'alpha', tree.root]);
      assert.notEqual(after.identity, before.identity);
    }
  } finally {
    tree.close();
  }
});
