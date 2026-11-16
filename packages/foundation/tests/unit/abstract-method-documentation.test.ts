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

const missingHeader = `/** Defines the work required of an implementation. */
abstract class Worker {
  abstract execute(): void;
}
`;

const presentHeader = `/** Defines the work required of an implementation. */
abstract class Worker {
  /** Performs the implementation's work. */
  abstract execute(): void;
}
`;

test('FND-4 reports the existing missing-header diagnostic for an abstract method', () => {
  const messages = linter.verify(missingHeader, config, { filename: 'fixture.ts' });

  assert.deepEqual(
    messages.map(({ ruleId, messageId, message }) => ({ ruleId, messageId, message })),
    [
      {
        ruleId: 'arcnexus/documentation',
        messageId: 'missing',
        message: 'Add a documentation header explaining purpose and effects.',
      },
    ],
  );
});

test('FND-4 accepts an abstract method with a documentation header', () => {
  const messages = linter.verify(presentHeader, config, { filename: 'fixture.ts' });

  assert.deepEqual(messages, []);
});
