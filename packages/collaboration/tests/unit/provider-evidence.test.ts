import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubPullReadFailure } from '../../src/index.js';
import {
  ProviderResults,
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
