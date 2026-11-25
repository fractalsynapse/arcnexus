import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubPullReadFailure } from '../../src/index.js';
import {
  ProviderResults,
  repository,
  pr,
  head,
  readyResponse,
} from '../fixtures/provider-results.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['delivery'] } as const;

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

test('staging verifies REST PR and CI facts with a separate authoritative review read', async (t) => {
  const scenario = new ProviderResults(t, readyResponse);
  await scenario.provider.verify(pr, head, 'staging');
  assert.equal(scenario.calls.filter((args) => args[1] === 'graphql').length, 1);
  assert.ok(scenario.calls.every((args) => !args.join(' ').includes('statusCheckRollup')));
  assert.ok(
    scenario.calls.some((args) => args[1]?.endsWith('/status') && args.includes('--paginate')),
  );
});

test('a wrong PR branch stops before any CI or review reads', async (t) => {
  const scenario = new ProviderResults(t, readyResponse);
  await assert.rejects(scenario.provider.verify(pr, head, 'staging', 'OPEN', '2-task'), {
    message: /outside the publication scope/,
  });
  assert.deepEqual(scenario.calls, [['api', repository + '/pulls/99']]);
});

test('PR lookup accepts GitHub canonical casing for the same bound repository', async (t) => {
  const scenario = new ProviderResults(
    t,
    (args) => readyResponse(args.map((arg, index) => (index === 1 ? arg.toLowerCase() : arg))),
    'https://github.com/Example/PROJECT.git',
  );
  await scenario.provider.verify(pr, head, 'staging', 'OPEN', '1-task');
});

test('PR discovery retains an invalid raw provider response', async (t) => {
  const output = '[{"html_url":"https://github.com/example/project/pull/99"}]';
  const scenario = new ProviderResults(t, () => output);
  await assert.rejects(scenario.provider.publication('1-task'), (error: unknown) => {
    assert.equal((error as { stdout?: string }).stdout, output);
    return true;
  });
});

test('invalid PR and review payloads retain the raw provider response', async (t) => {
  const output = '{"expected_provider_fact_missing":true}';
  for (const endpoint of [repository + '/pulls/99', 'graphql']) {
    const scenario = new ProviderResults(t, (args) =>
      args[1] === endpoint ? output : readyResponse(args),
    );
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
      assert.ok(error instanceof GitHubPullReadFailure);
      assert.equal((error.cause as { stdout?: string }).stdout, output);
      return true;
    });
  }
});

test('a conflicting PR head is retained with the unavailable identity', async (t) => {
  const scenario = new ProviderResults(t, readyResponse);
  await assert.rejects(scenario.provider.verify(pr, 'f'.repeat(40), 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.pull?.head, head);
    return true;
  });
});
