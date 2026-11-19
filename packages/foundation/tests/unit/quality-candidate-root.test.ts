import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectQualityInputs } from '../../src/index.js';
import { fixture, QualityFixture, selection } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} keeps concurrent candidate ignore identities isolated`, async () => {
    const first = fixture();
    const second = fixture();
    try {
      first.write('.gitignore', '# first candidate\n');
      second.write('.gitignore', '# second candidate\n');
      const select = (tree: QualityFixture) => selectQualityInputs(operation, 'alpha', tree.root);
      const expectedFirst = await select(first);
      const expectedSecond = await select(second);
      assert.notEqual(expectedFirst.identity, expectedSecond.identity);
      const [actualFirst, actualSecond] = await Promise.all([select(first), select(second)]);
      assert.deepEqual(actualFirst, expectedFirst);
      assert.deepEqual(actualSecond, expectedSecond);
    } finally {
      first.close();
      second.close();
    }
  });

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
