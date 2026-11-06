import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubPullRequests } from '../../../../dist/library/operations/github-pull-requests.js';
import type { DeliveryRecord } from '../../../../dist/library/coordination-store/delivery-types.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises production provider routing with controlled GitHub HTTP responses and no upstream writes. */
class PullRequestFixture {
  readonly head = 'a'.repeat(40);

  readonly delivery: DeliveryRecord = {
    id: 'd'.repeat(64),
    projectId: 'project',
    packageId: 'package',
    runId: 'run',
    assignmentIds: ['assignment'],
    environment: { id: 'live', mode: 'live' },
    authorityDigest: 'authority',
    base: 'b'.repeat(40),
    candidate: 'c'.repeat(40),
    verification: { references: ['report'], digest: 'verified' },
    publicationDocument: {
      title: 'Fix cancelled promotion retries',
      body: '## Summary\n\nRetry explicitly cancelled promotion attempts.',
    },
    target: { repository: 'example/project', branch: 'staging' },
    version: 1,
    createdAt: '2026-11-03T00:00:00Z',
    engineering: 'verified',
    delivery: 'pushed',
    integration: 'not_requested',
    publication: 'not_requested',
    receipts: {},
  };

  readonly effect: ExternalEffect = {
    id: 'pr',
    environmentId: 'live',
    runId: 'run',
    operation: 'pull-request.create',
    target: 'example/project',
    definitionDigest: 'grant',
    inputDigest: 'input',
    status: 'uncertain',
    attempt: 1,
    input: {
      deliveryId: this.delivery.id,
      title: 'Fix cancelled promotion retries',
      body: '## Summary\n\nRetry explicitly cancelled promotion attempts.',
    },
  };

  readonly requests: Array<{ url: string; options: RequestInit }> = [];

  readonly responses: unknown[] = [];

  readonly signal = new AbortController().signal;

  readonly provider = new GitHubPullRequests(
    this.delivery,
    this.head,
    async () => 'test-secret',
    async (url, options) => {
      this.requests.push({ url: String(url), options: options! });
      assert.notEqual(this.responses.length, 0, 'Unexpected provider request');
      return new Response(JSON.stringify(this.responses.shift()));
    },
  );

  /** Supplies actual provider shapes for the immutable expected delivery branch and repository. */
  pull(body = '') {
    const repo = { full_name: this.delivery.target.repository };
    return {
      number: 17,
      html_url: 'https://github.com/example/project/pull/17',
      body,
      head: { sha: this.head, ref: 'arcnexus/' + this.delivery.id, repo },
      base: { ref: 'staging', repo },
    };
  }

  readonly checkedCommit = {
    oid: this.head,
    statusCheckRollup: { state: 'SUCCESS', contexts: { totalCount: 3 } },
  };

  /** Supplies provider-computed readiness with checks bound to the captured commit. */
  gates(overrides: Record<string, unknown> = {}, repository: Record<string, unknown> = {}) {
    return {
      data: {
        repository: {
          nameWithOwner: this.delivery.target.repository,
          defaultBranchRef: { name: 'main' },
          pullRequest: {
            number: 17,
            url: 'https://github.com/example/project/pull/17',
            headRefOid: this.head,
            headRefName: 'arcnexus/' + this.delivery.id,
            headRepository: { nameWithOwner: this.delivery.target.repository },
            baseRefName: 'staging',
            baseRefOid: 'b'.repeat(40),
            state: 'OPEN',
            isDraft: false,
            mergeable: 'MERGEABLE',
            mergeStateStatus: 'CLEAN',
            reviewDecision: 'APPROVED',
            commits: { nodes: [{ commit: this.checkedCommit }] },
            ...overrides,
          },
          ...repository,
        },
      },
    };
  }

  /** Queues host metadata, actual pushed ref, target branch and absence of an existing correlated PR. */
  ready(): void {
    this.responses.push(
      { default_branch: 'main' },
      { object: { type: 'commit', sha: this.head } },
      { name: 'staging' },
      [],
    );
  }

  /** Creates a real-shaped receipt and returns its retained correlation marker for recovery scenarios. */
  async create(): Promise<string> {
    this.ready();
    this.responses.push(this.pull());
    const result = await this.provider.apply(this.effect, this.signal);
    assert.equal(result.pullRequestId, 17);
    assert.equal(result.simulation, false);
    assert.equal(JSON.stringify(result).includes('test-secret'), false);
    return JSON.parse(String(this.requests.at(-1)!.options.body)).body;
  }
}

test('GitHub delivery PR creation pins target and head without granting review or merge', async () => {
  const f = new PullRequestFixture();
  const body = await f.create();
  assert.match(body, /arcnexus-effect:/);
  assert.ok(body.startsWith(String(f.effect.input.body)));
  assert.equal(JSON.parse(String(f.requests.at(-1)!.options.body)).title, f.effect.input.title);
  assert.equal(f.requests.filter((r) => r.options.method !== 'GET').length, 1);
  const request = f.requests.at(-1)!;
  assert.equal(request.url, 'https://api.github.com/repos/example/project/pulls');
  assert.equal(request.options.redirect, 'error');
  assert.equal(JSON.parse(String(request.options.body)).maintainer_can_modify, false);
});

test('GitHub delivery PR recovery requires unique unchanged attribution and preserves uncertainty', async () => {
  const f = new PullRequestFixture();
  const body = await f.create();
  f.responses.push([f.pull(body)]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'completed');
  f.responses.push([]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'unknown');
  f.responses.push([f.pull(body), f.pull(body)]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'unknown');
  const changed = f.pull(body);
  changed.head.sha = 'f'.repeat(40);
  f.responses.push([changed]);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'rejected');
});

test('GitHub PR repeated delivery intent reuses its correlated PR without another mutation', async () => {
  const f = new PullRequestFixture();
  const body = await f.create();
  const writes = f.requests.filter((r) => r.options.method === 'POST').length;
  f.ready();
  f.responses[f.responses.length - 1] = [f.pull(body)];
  assert.equal((await f.provider.apply(f.effect, f.signal)).pullRequestId, 17);
  assert.equal(f.requests.filter((r) => r.options.method === 'POST').length, writes);
});

test('GitHub PR creation blocks default targets, changed branch heads and caller substitutions', async () => {
  const f = new PullRequestFixture();
  await assert.rejects(f.provider.apply({ ...f.effect, environmentId: 'simulation' }, f.signal));
  assert.equal(f.requests.length, 0);
  f.responses.push({ default_branch: 'staging' });
  await assert.rejects(f.provider.apply(f.effect, f.signal), /default or main/);
  f.responses.push({ default_branch: 'main' }, { object: { type: 'commit', sha: 'f'.repeat(40) } });
  await assert.rejects(f.provider.apply(f.effect, f.signal), /verified pushed head/);
  assert.equal(
    f.requests.every((r) => r.options.method === 'GET'),
    true,
  );
});

test('GitHub readiness observes exact-head checks and reviews without creating provider effects', async () => {
  const f = new PullRequestFixture();
  f.responses.push(f.gates());
  const result = await f.provider.readiness(17, f.signal);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  const request = f.requests[0]!;
  assert.equal(request.url, 'https://api.github.com/graphql');
  const body = JSON.parse(String(request.options.body));
  assert.deepEqual(body.variables, { owner: 'example', name: 'project', number: 17 });
  assert.match(body.query, /^query/);
  assert.equal(request.options.redirect, 'error');
});

test('GitHub readiness refuses missing CI, unknown or pending reviews and non-ready targets', async () => {
  const f = new PullRequestFixture();
  for (const state of [
    { commits: { nodes: [] } },
    { reviewDecision: 'REVIEW_REQUIRED' },
    { reviewDecision: 'CHANGES_REQUESTED' },
    { reviewDecision: undefined },
    { mergeStateStatus: 'BLOCKED' },
    { mergeable: 'CONFLICTING' },
    { isDraft: true },
    { state: 'CLOSED' },
    { baseRefOid: null },
  ]) {
    f.responses.push(f.gates(state));
    assert.equal((await f.provider.readiness(17, f.signal)).ready, false, JSON.stringify(state));
  }
  f.responses.push(f.gates({}, { defaultBranchRef: { name: 'staging' } }));
  assert.equal((await f.provider.readiness(17, f.signal)).ready, false);
});

test('GitHub readiness rejects substituted heads and partial GraphQL responses', async () => {
  const f = new PullRequestFixture();
  f.responses.push(f.gates({ headRefOid: 'f'.repeat(40) }));
  await assert.rejects(f.provider.readiness(17, f.signal), /attribution/);
  f.responses.push({ ...f.gates(), errors: [{ message: 'inaccessible review state' }] });
  await assert.rejects(f.provider.readiness(17, f.signal), /incomplete/);
  f.responses.push(f.gates({}, { nameWithOwner: 'other/repository' }));
  await assert.rejects(f.provider.readiness(17, f.signal), /captured repository/);
  await assert.rejects(f.provider.readiness(-1, f.signal), /identity/);
  assert.equal(f.responses.length, 0);
});

registerSuite({
  component: 'operations',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
