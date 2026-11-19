import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { documentation } from '../../scripts/readability-rules.js';

const linter = new Linter();
const config: Linter.Config = {
  files: ['**/*.ts'],
  languageOptions: { parser: tseslint.parser },
  plugins: { arcnexus: { rules: { documentation } } },
  rules: { 'arcnexus/documentation': 'error' },
};

const declarations = {
  class: (header: string) => `${header}\nclass Worker {}`,
  constructor: (header: string) =>
    `/** Represents a worker. */\nclass Worker {\n  ${header}\n  constructor() {}\n}`,
  method: (header: string) =>
    `/** Represents a worker. */\nclass Worker {\n  ${header}\n  execute(): void {}\n}`,
  abstractMethod: (header: string) =>
    `/** Defines a worker. */\nabstract class Worker {\n  ${header}\n  abstract execute(): void;\n}`,
};

const emptyHeaders = {
  empty: '/** */',
  whitespace: '/**   \n    \t */',
  decorative: '/**\n   *\n   ***\n   */',
};

for (const [kind, declaration] of Object.entries(declarations)) {
  for (const [form, header] of Object.entries(emptyHeaders)) {
    test(`FND-4 rejects ${form} documentation on ${kind}`, () => {
      const messages = linter.verify(declaration(header), config, { filename: 'fixture.ts' });

      assert.deepEqual(
        messages.map(({ ruleId, messageId }) => ({ ruleId, messageId })),
        [{ ruleId: 'arcnexus/documentation', messageId: 'missing' }],
      );
    });
  }

  test(`FND-4 accepts meaningful documentation on ${kind}`, () => {
    const messages = linter.verify(declaration('/** Describes the responsibility. */'), config, {
      filename: 'fixture.ts',
    });

    assert.deepEqual(messages, []);
  });
}
