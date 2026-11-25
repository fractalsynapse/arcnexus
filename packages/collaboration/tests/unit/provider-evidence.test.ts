import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GitHubCheckFailure,
  GitHubPullReadFailure,
  GitHubReviewRejection,
} from '../../src/index.js';
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

test('an unavailable legacy status read retains failed attempts excluded from the current selection', async (t) => {
  const current = { ...successfulRun, app: { id: 9 }, check_suite: { id: 5 } };
  const previous = { ...current, id: 41, conclusion: 'failure' };
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/check-runs?filter=latest'))
      return JSON.stringify({ total_count: 1, check_runs: [current] });
    if (args[1]?.includes('/check-runs?filter=all'))
      return JSON.stringify({ total_count: 2, check_runs: [previous, current] });
    if (args[1]?.endsWith('/status')) throw new Error('Legacy status unavailable');
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (failure) => {
    assert(failure instanceof GitHubPullReadFailure);
    assert.deepEqual(
      failure.observation.checks?.map(({ runId }) => runId),
      [42],
    );
    const prior = failure.observation.observedChecks?.find(({ runId }) => runId === 41);
    assert.equal(prior?.conclusion, 'FAILURE');
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

test('a terminal check failure retains the preceding snapshot from the same observation', async (t) => {
  const completing = completingSuite('failure');
  let statuses = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/status')) return completing(args);
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [
        { context: 'lint', state: ++statuses === 1 ? 'failure' : 'success', target_url: null },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubCheckFailure);
    assert.equal(error.log, 'Retained actual failure');
    assert.equal(error.observation?.earlierChecks?.[0]?.checks[1]?.state, 'FAILURE');
    return true;
  });
});

test('review rejection retains earlier CI evidence without becoming an unavailable read', async (t) => {
  const completing = completingSuite('success');
  let statuses = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1] === 'graphql') {
      const pull = JSON.parse(readyResponse(args)).data.repository.pullRequest;
      return JSON.stringify({
        data: { repository: { pullRequest: { ...pull, reviewDecision: 'CHANGES_REQUESTED' } } },
      });
    }
    if (!args[1]?.endsWith('/status')) return completing(args);
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [
        { context: 'lint', state: ++statuses === 1 ? 'failure' : 'success', target_url: null },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert(error instanceof GitHubReviewRejection);
    assert.match(error.message, /review requested changes/);
    assert.equal(error.observation.reviewDecision, 'CHANGES_REQUESTED');
    assert.equal(error.observation.earlierChecks?.[0]?.checks[1]?.state, 'FAILURE');
    return true;
  });
});

test('a later polling attempt retains CI evidence from before the wait', async (t) => {
  const completing = completingSuite('success');
  let pulls = 0;
  let statuses = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99') && ++pulls === 2) throw new Error('PR read unavailable');
    if (args[1] === 'graphql')
      return readyResponse(args).replace(
        '"reviewDecision":null',
        '"reviewDecision":"REVIEW_REQUIRED"',
      );
    if (!args[1]?.endsWith('/status')) return completing(args);
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [
        { context: 'lint', state: ++statuses === 1 ? 'failure' : 'success', target_url: null },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.earlierChecks?.[0]?.checks[1]?.state, 'FAILURE');
    return true;
  });
});

test('a later unavailable read retains a stable pending observation', async (t) => {
  let pulls = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99') && ++pulls === 2) throw new Error('PR read unavailable');
    if (!args[1]?.endsWith('/status')) return readyResponse(args);
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [{ context: 'lint', state: 'pending', target_url: null }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.earlierChecks?.[0]?.checks[1]?.state, 'PENDING');
    return true;
  });
});

test('a pending confirmation preserves the initial green observation before a later read failure', async (t) => {
  const completing = completingSuite('success');
  let pulls = 0;
  let statuses = 0;
  let reviewed = false;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99') && ++pulls === 2) throw new Error('Pull unavailable');
    if (args[1] === 'graphql') reviewed = true;
    if (!args[1]?.endsWith('/status')) return completing(args);
    const state = reviewed ? 'pending' : ++statuses === 1 ? 'pending' : 'success';
    return JSON.stringify({
      sha: head,
      total_count: 1,
      statuses: [{ context: 'CI', state, target_url: null }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (failure) => {
    assert(failure instanceof GitHubPullReadFailure);
    const history = failure.observation.earlierChecks ?? [];
    assert(
      history.some(
        ({ phase, checks }) =>
          phase === 'CI checks' &&
          checks.some(({ context, state }) => context === 'CI' && state === 'SUCCESS'),
      ),
    );
    assert(history.some(({ phase }) => phase === 'CI confirmation'));
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
