import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GitHub, GitHubCheckFailure } from '../../src/index.js';

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
    const transport = this.provider as unknown as {
      command(args: string[], complete?: boolean): Promise<string>;
    };
    t.mock.method(transport, 'command', async (args: string[], complete = false) => {
      this.calls.push(args);
      const output = result(args);
      return complete ? output : output.trim();
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

test('a failed pinned check carries the complete provider job log without trimming', async (t) => {
  const log = '\nComplete provider log\n  actual assertion failure\nfinal conclusion\n\n';
  const check = {
    name: 'Repository checks',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/example/project/actions/runs/7/job/42',
  };
  const scenario = new ProviderResults(t, (args) =>
    args[0] === 'api'
      ? log
      : JSON.stringify({
          state: 'OPEN',
          headRefOid: 'head',
          baseRefName: 'staging',
          statusCheckRollup: [check],
        }),
  );
  await assert.rejects(scenario.provider.verify('pull', 'head', 'staging'), (error) => {
    assert.ok(error instanceof GitHubCheckFailure);
    assert.equal(error.pr, 'pull');
    assert.equal(error.head, 'head');
    assert.deepEqual(error.check, check);
    assert.equal(error.log, log);
    return true;
  });
  assert.deepEqual(scenario.calls[1], ['api', 'repos/example/project/actions/jobs/42/logs']);
});
