import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const;

/** Exercise suppression rejection through the real repository configuration without CLI quotas. */
class InlineConfigurationScenario {
  private readonly linter = new ESLint();

  /** Require an error-level directive diagnostic independently of the built-in warning. */
  async reject(comment: string) {
    const [result] = await this.lint(`${comment}\nexport const value = 1;\n`);
    assert.deepEqual(
      result!.messages
        .filter(({ severity }) => severity === 2)
        .map(({ ruleId, messageId }) => ({
          ruleId,
          messageId,
        })),
      [{ ruleId: 'arcnexus/no-inline-configuration', messageId: 'forbidden' }],
    );
  }

  /** Preserve ordinary documentation and directive-like text inside source strings. */
  async accept() {
    const [result] = await this.lint(
      '/** Explain the exported text. */\n// eslint-plugin documentation is ordinary prose.\nexport const text = "eslint-disable";\n',
    );
    assert.deepEqual(result!.messages, []);
  }

  /** Lint virtual owned TypeScript without creating source or relying on command-line warning counts. */
  private lint(source: string) {
    return this.linter.lintText(source, {
      filePath: 'packages/foundation/tests/fixtures/inline-configuration.ts',
    });
  }
}

for (const comment of [
  '/* eslint-disable */',
  '// eslint-disable-next-line no-debugger',
  '/* eslint no-debugger: off */',
]) {
  test(`FND-3 rejects inline configuration as an error: ${comment}`, async () => {
    await new InlineConfigurationScenario().reject(comment);
  });
}

test('FND-3 accepts documentation and literal directive text', async () => {
  await new InlineConfigurationScenario().accept();
});
