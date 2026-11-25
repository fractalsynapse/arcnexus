import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubCheckFailure, GitHubPullReadFailure } from '../../src/index.js';
import {
  ProviderResults,
  completingSuite,
  pr,
  head,
  successfulRun,
  readyResponse,
} from '../fixtures/provider-results.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['delivery'] } as const;

test('unavailable suite metadata retains the completed ref check read', async (t) => {
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/check-suites') && ++inventories === 2)
      throw new Error('Suite inventory unavailable');
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.checks?.[0]?.runId, successfulRun.id);
    return true;
  });
});

test('a failed refresh retains the completed review and the prior check snapshot', async (t) => {
  let reviewReceived = false;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1] === 'graphql') reviewReceived = true;
    if (reviewReceived && args[1]?.includes('/check-runs?'))
      throw new Error('CI refresh unavailable');
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.reviewDecision, null);
    assert.equal(error.observation.checks?.[0]?.runId, successfulRun.id);
    return true;
  });
});

test('a failed completion reread retains the earlier legacy status alongside the current run', async (t) => {
  const completing = completingSuite('success');
  let statuses = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/status')) return completing(args);
    if (++statuses > 1) throw new Error('Legacy status read unavailable');
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [{ context: 'lint', state: 'failure', target_url: null }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.checks?.[0]?.status, 'COMPLETED');
    const earlier = error.observation.earlierChecks?.[0];
    assert.equal(earlier?.phase, 'CI checks');
    assert.equal(earlier.checks[0]?.status, 'IN_PROGRESS');
    assert.equal(earlier.checks[1]?.context, 'lint');
    assert.equal(earlier.checks[1]?.state, 'FAILURE');
    return true;
  });
});

test('a malformed CI page retains the original output and the valid preceding page', async (t) => {
  const output = JSON.stringify({ total_count: 2, check_runs: [successfulRun] }) + '\nmalformed';
  const scenario = new ProviderResults(t, (args) =>
    args[1]?.includes('/check-runs?') ? output : readyResponse(args),
  );
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal((error.cause as { stdout?: string }).stdout, output);
    return true;
  });
});

test('third-party latest results cannot contradict the same ref check', async (t) => {
  const current = { ...successfulRun, app: { id: 9 }, check_suite: { id: 5 } };
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/check-suites/5/check-runs'))
      return JSON.stringify({
        total_count: 1,
        check_runs: [{ ...current, status: 'queued', conclusion: null }],
      });
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [current, { ...current, id: 99, conclusion: 'failure' }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.match(error.message, /ref and suite disagree/);
    assert.ok(error.observation.checks?.some((check) => check.status === 'QUEUED'));
    return true;
  });
});

test('conflicting CI evidence preserves the exact suite and app identity', async (t) => {
  const current = { ...successfulRun, app: { id: 9, slug: 'ci' }, check_suite: { id: 5 } };
  const conflicting = { ...current, app: { id: 9, slug: 'other-ci' }, check_suite: { id: 6 } };
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/check-suites/5/check-runs'))
      return JSON.stringify({ total_count: 1, check_runs: [conflicting] });
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [current, { ...current, id: 99, conclusion: 'failure' }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    const observed = error.observation.checks?.filter((check) => check.runId === current.id);
    const identities = observed?.map(({ appSlug, suiteId }) => [appSlug, suiteId]);
    assert.deepEqual(identities, [
      ['ci', 5],
      ['other-ci', 6],
    ]);
    return true;
  });
});

const failedCheck = {
  runId: 42,
  appId: 8,
  appSlug: 'github-actions',
  suiteId: undefined,
  name: 'Repository checks',
  status: 'COMPLETED',
  conclusion: 'FAILURE',
  detailsUrl: 'https://github.com/example/project/actions/runs/7/job/42',
};

test('a failed pinned check carries the complete provider job log without trimming', async (t) => {
  const log = '\nComplete provider log\n  actual assertion failure\nfinal conclusion\n\n';
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/jobs/42/logs')) return log;
    if (args[1]?.includes('/check-runs?')) {
      return JSON.stringify({
        total_count: 1,
        check_runs: [{ ...successfulRun, conclusion: 'failure' }],
      });
    }
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubCheckFailure);
    assert.equal(error.pr, pr);
    assert.equal(error.head, head);
    assert.deepEqual(error.check, failedCheck);
    assert.equal(error.log, log);
    return true;
  });
  assert.deepEqual(scenario.calls.at(-1), ['api', 'repos/example/project/actions/jobs/42/logs']);
});
