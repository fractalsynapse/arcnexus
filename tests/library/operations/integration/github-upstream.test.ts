import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubUpstream } from '../../../../dist/library/operations/github-upstream.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Supplies recorded HTTP inputs at the provider transport boundary, without upstream mutations. */
class GitHubFixture {
  readonly requests: Array<{ url: string; options: RequestInit }> = [];

  readonly responses: unknown[] = [];

  readonly signal = new AbortController().signal;

  readonly effect: ExternalEffect = {
    id: 'effect',
    environmentId: 'live',
    runId: 'run',
    assignmentId: 'assignment',
    operation: 'issue.create',
    target: 'example/project',
    definitionDigest: 'operation',
    inputDigest: 'input',
    status: 'uncertain',
    attempt: 1,
    input: { title: 'Useful work', body: 'Acceptance' },
  };

  readonly provider = new GitHubUpstream(
    'github',
    'live',
    'example/project',
    async () => 'test-host-credential',
    async (url, options) => {
      this.requests.push({ url: String(url), options: options! });
      return new Response(JSON.stringify(this.responses.shift()), { status: 200 });
    },
  );

  /** Creates the provider-shaped response used by controlled acceptance tests. */
  response(body = '') {
    return { id: 42, number: 7, html_url: 'https://github.com/example/project/issues/7', body };
  }
}

test('GitHub issue creation sends credentials only to the captured host and retains a safe receipt', async () => {
  const f = new GitHubFixture();
  f.responses.push(f.response());
  const result = await f.provider.apply(f.effect, f.signal);
  assert.equal(result.issueId, 7);
  assert.equal(result.simulation, false);
  assert.equal(JSON.stringify(result).includes('credential'), false);
  assert.equal(f.requests[0]!.url, 'https://api.github.com/repos/example/project/issues');
  assert.equal(f.requests[0]!.options.redirect, 'error');
  assert.match(String(f.requests[0]!.options.body), /arcnexus-effect:/);
});

test('GitHub reconciliation requires exactly one durable intent marker and never assumes absence', async () => {
  const f = new GitHubFixture();
  f.responses.push(f.response());
  await f.provider.apply(f.effect, f.signal);
  const body = JSON.parse(String(f.requests[0]!.options.body)).body;
  f.responses.push([f.response(body)]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'completed');
  f.responses.push([]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'unknown');
  f.responses.push([f.response(body), { ...f.response(body), id: 43 }]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'unknown');
});

test('GitHub rejects cross-environment destinations and unsupported mutations without transport', async () => {
  const f = new GitHubFixture();
  for (const change of [
    { environmentId: 'simulation' },
    { target: 'another/repository' },
    { operation: 'release.publish' },
    { operation: 'issue.comment', input: { issueId: '../main' } },
  ])
    await assert.rejects(() => f.provider.apply({ ...f.effect, ...change }, f.signal));
  assert.equal(f.requests.length, 0);
});

registerSuite({
  component: 'operations',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
