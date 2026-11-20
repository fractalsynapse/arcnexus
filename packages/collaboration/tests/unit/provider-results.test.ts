import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GitHub } from '../../src/index.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['delivery'] } as const;

/** Exercise public provider operations while replacing only external command transport. */
class ProviderResults {
  readonly calls: string[][] = [];
  readonly provider = new GitHub(
    'https://github.com/example/project.git',
    new AbortController().signal,
  );

  /** Retain actual command inputs and supply explicit provider-page fixtures. */
  constructor(t: TestContext, result: (args: string[]) => string) {
    const transport = this.provider as unknown as { command(args: string[]): Promise<string> };
    t.mock.method(transport, 'command', async (args: string[]) => {
      this.calls.push(args);
      return result(args);
    });
  }
}

test('provider titles preserve the supplied text without an application character cap', async (t) => {
  const scenario = new ProviderResults(t, () => 'https://github.com/example/project/pull/99');
  const title = 'A complete descriptive change title. '.repeat(10);
  await scenario.provider.pull('staging', 'work', title, 'Complete body');
  const args = scenario.calls[0]!;
  assert.equal(args[args.indexOf('--title') + 1], title.trim());
});

test('issue recovery examines every provider page before deciding an issue is absent', async (t) => {
  const task = 'a'.repeat(64);
  const first = [{ number: 1, body: 'Another task' }];
  const last = [{ number: 207, body: `Complete goal\n<!-- arcnexus-task:${task} -->` }];
  const scenario = new ProviderResults(t, (args) =>
    args.includes('--paginate')
      ? `${JSON.stringify(first)}\n${JSON.stringify(last)}\n`
      : JSON.stringify(first),
  );
  assert.equal(await scenario.provider.findIssue(task, 'b'.repeat(64)), '207');
});
