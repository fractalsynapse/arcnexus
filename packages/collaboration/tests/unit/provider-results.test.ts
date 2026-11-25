import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubCheckFailure, GitHubPullReadFailure } from '../../src/index.js';
import {
  ProviderResults,
  completingSuite,
  pr,
  head,
  review,
  successfulRun,
  readyResponse,
  workflowJobs,
} from '../fixtures/provider-results.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['delivery'] } as const;

function paginatedStatuses(contexts: string[]) {
  return contexts
    .map((context) =>
      JSON.stringify({
        sha: head,
        total_count: contexts.length,
        statuses: [{ context, state: 'success', target_url: null }],
      }),
    )
    .join('\n');
}

test('an unavailable review read preserves every check and legacy context in the observation', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/check-runs?')) {
      return [successfulRun, { ...successfulRun, id: 43, app: { id: 9 } }]
        .map((result) => JSON.stringify({ total_count: 2, check_runs: [result] }))
        .join('\n');
    }
    if (args[1]?.endsWith('/status')) return paginatedStatuses(['lint', 'types']);
    if (args[1] === 'graphql') throw new Error('GraphQL: internal error, request ref ABC');
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.read, 'review decision');
    assert.equal(error.observation.pull?.head, head);
    assert.deepEqual(
      error.observation.checks?.map((item) => item.name ?? item.context),
      ['Repository checks', 'Repository checks', 'lint', 'types'],
    );
    assert.match(error.message, /request ref ABC/);
    return true;
  });
});

test('incomplete check pages cannot authorize a pull request', async (t) => {
  const scenario = new ProviderResults(t, (args) =>
    args[1]?.includes('/check-runs?')
      ? JSON.stringify({ total_count: 2, check_runs: [successfulRun] })
      : readyResponse(args),
  );
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /CI checks unavailable.*incomplete or inconsistent CI pages/,
  });
  assert.ok(scenario.calls.every((args) => args[1] !== 'graphql'));
});

function overlappingSuiteRun(id: string) {
  const retry = {
    ...successfulRun,
    id: 1,
    started_at: '2026-11-24T00:01:00Z',
    completed_at: '2026-11-24T00:02:00Z',
    conclusion: 'failure',
    details_url: 'https://github.com/example/project/actions/runs/7/job/1',
  };
  const old = {
    ...successfulRun,
    id: 99,
    details_url: 'https://github.com/example/project/actions/runs/7/job/99',
    completed_at: '2026-11-24T00:03:00Z',
  };
  const independent = { ...successfulRun, id: 50, app: { id: 9 }, name: 'Earlier producer' };
  return { '1': old, '2': retry, '3': independent }[id];
}

const suites = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, head_sha: head }));

function suiteResponse(args: string[], resolve: (id: string) => unknown) {
  if (args[1]?.endsWith('/check-suites')) {
    const total_count = suites.length;
    return args.includes('--paginate')
      ? JSON.stringify({ total_count, check_suites: suites })
      : JSON.stringify({ total_count });
  }
  if (args[1]?.includes('/commits/') && args[1].includes('/check-runs?'))
    return JSON.stringify({ total_count: 0, check_runs: [] });
  const match = /\/check-suites\/(\d+)\/check-runs/.exec(args[1] ?? '');
  if (!match?.[1]) return readyResponse(args);
  const check = resolve(match[1]);
  return JSON.stringify({ total_count: check ? 1 : 0, check_runs: check ? [check] : [] });
}

function latestFailure(error: unknown) {
  assert.ok(error instanceof GitHubCheckFailure);
  assert.equal(error.check.runId, 1);
  return true;
}

test('suite pagination finds omitted checks and orders overlapping attempts by start time', async (t) => {
  const scenario = new ProviderResults(t, (args) => suiteResponse(args, overlappingSuiteRun));
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), latestFailure);
  assert.equal(
    scenario.calls.filter((args) => /\/check-suites\/\d+\/check-runs/.test(args[1] ?? '')).length,
    suites.length,
  );
});

test('ordinary refs apply the same attempt ordering as the suite path', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    const old = overlappingSuiteRun('1');
    const runs = args[1].endsWith('filter=all') ? [old, overlappingSuiteRun('2')] : [old];
    return JSON.stringify({ total_count: runs.length, check_runs: runs });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), latestFailure);
});

test('a queued rerun stays pending in the presence of a prior failure', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/actions/runs/7/jobs?'))
      return workflowJobs([
        [1, 1],
        [2, 2],
      ]);
    if (args[1] === 'graphql') scenario.cancellation.abort();
    return suiteResponse(args, (id) => {
      if (id === '1') return overlappingSuiteRun('2');
      if (id === '2')
        return {
          ...successfulRun,
          id: 2,
          started_at: null,
          status: 'queued',
          conclusion: null,
          details_url: 'https://github.com/example/project/actions/runs/7/job/2',
        };
      return undefined;
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
});

test('an unavailable suite retains checks already read from other suites', async (t) => {
  const scenario = new ProviderResults(t, (args) =>
    suiteResponse(args, (id) => {
      if (id === '1') return overlappingSuiteRun('1');
      throw new Error('The next suite is unavailable');
    }),
  );
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.ok(error.observation.checks?.some(({ runId }) => runId === 99));
    return true;
  });
});

test('independent workflows from the same App cannot mask a same-name failure', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [
        {
          ...successfulRun,
          id: 99,
          conclusion: 'failure',
          details_url: 'https://github.com/example/project/actions/runs/7/job/99',
        },
        {
          ...successfulRun,
          started_at: '2026-11-24T00:02:00Z',
          details_url: 'https://github.com/example/project/actions/runs/10/job/42',
        },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubCheckFailure);
    assert.equal(error.check.runId, 99);
    return true;
  });
});

test('a completed cancellation without a start is superseded by a later attempt', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/actions/runs/7/jobs?'))
      return workflowJobs([
        [99, 1],
        [42, 2],
      ]);
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [
        {
          ...successfulRun,
          id: 99,
          started_at: null,
          completed_at: '2026-11-23T23:59:00Z',
          conclusion: 'cancelled',
          details_url: 'https://github.com/example/project/actions/runs/7/job/99',
        },
        successfulRun,
      ],
    });
  });
  await scenario.provider.verify(pr, head, 'staging');
});

test('third-party reruns use the latest checks reported by their own suite', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    const current = { ...successfulRun, app: { id: 9 }, check_suite: { id: 5 } };
    if (args[1]?.includes('/check-suites/5/check-runs'))
      return JSON.stringify({ total_count: 1, check_runs: [current] });
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [{ ...current, id: 99, conclusion: 'failure' }, current],
    });
  });
  await scenario.provider.verify(pr, head, 'staging');
});

function ambiguousJobChecks() {
  return JSON.stringify({
    total_count: 3,
    check_runs: [
      {
        ...successfulRun,
        id: 99,
        conclusion: 'failure',
        details_url: 'https://github.com/example/project/actions/runs/7/job/99',
      },
      {
        ...successfulRun,
        id: 1,
        conclusion: 'failure',
        details_url: 'https://github.com/example/project/actions/runs/7/job/1',
      },
      successfulRun,
    ],
  });
}

test('ambiguous same-name jobs remain ineligible after a partial rerun', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/actions/runs/7/jobs?'))
      return workflowJobs([
        [99, 1],
        [1, 1],
        [42, 2],
      ]);
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return ambiguousJobChecks();
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /ambiguous same-name jobs/,
  });
});

test('workflow jobs added after the check snapshot stop integration', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/actions/runs/7/jobs?'))
      return workflowJobs([
        [99, 1],
        [42, 2],
        [81, 3],
      ]);
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_runs: [overlappingSuiteRun('1'), successfulRun],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /workflow jobs changed/,
  });
});

test('a suite traversal cannot discard a check already observed by the ref endpoint', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/commits/') && args[1].includes('/check-runs?'))
      return JSON.stringify({ total_count: 1, check_runs: [successfulRun] });
    return suiteResponse(args, (id) => (id === '1' ? overlappingSuiteRun('1') : undefined));
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /omitted an observed check/,
  });
});

test('a different suite inventory invalidates an otherwise green CI snapshot', async (t) => {
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/check-suites') || ++inventories === 1) return readyResponse(args);
    return JSON.stringify({
      total_count: 2,
      check_suites: [
        { id: 5, head_sha: head },
        { id: 6, head_sha: head },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /suite inventory changed/,
  });
});

for (const conclusion of ['success', 'failure'] as const) {
  test(`a suite completing during observation is reread before reporting ${conclusion}`, async (t) => {
    const scenario = new ProviderResults(t, completingSuite(conclusion));
    const verification = scenario.provider.verify(pr, head, 'staging');
    if (conclusion === 'success') await verification;
    else
      await assert.rejects(verification, (failure: unknown) => {
        assert(failure instanceof GitHubCheckFailure);
        assert.equal(failure.check.conclusion, 'FAILURE');
        assert.equal(failure.log, 'Retained actual failure');
        return true;
      });
    assert(scenario.calls.filter((args) => args[1]?.endsWith('/check-suites')).length > 2);
  });
}

test('one suite can start while another completes during the same observation', async (t) => {
  const completing = completingSuite('success');
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    const output = completing(args);
    if (!args[1]?.endsWith('/check-suites')) return output;
    const suites = JSON.parse(output).check_suites;
    const status = ['queued', 'in_progress'][inventories++] ?? 'completed';
    suites.push({ id: 6, head_sha: head, status, latest_check_runs_count: 0 });
    return JSON.stringify({ total_count: suites.length, check_suites: suites });
  });
  await scenario.provider.verify(pr, head, 'staging');
  assert(inventories > 3);
});

for (const reportedRuns of [0, 1]) {
  test(`a pending suite with ${reportedRuns} expected invisible runs cannot authorize delivery`, async (t) => {
    let scheduled = false;
    const scenario = new ProviderResults(t, (args) => {
      if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
      if (!scheduled) {
        scheduled = true;
        setImmediate(() => scenario.cancellation.abort());
      }
      return JSON.stringify({
        total_count: 2,
        check_suites: [
          { id: 5, head_sha: head, status: 'completed' },
          { id: 6, head_sha: head, status: 'queued', latest_check_runs_count: reportedRuns },
        ],
      });
    });
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
  });
}

test('stable suite metadata cannot hide runs missing from the ref snapshot', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
    return JSON.stringify({
      total_count: 1,
      check_suites: [{ id: 5, head_sha: head, latest_check_runs_count: 1 }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /suite .* missing check runs/,
  });
});

test('a status that becomes pending during review cannot authorize delivery', async (t) => {
  let reviewReceived = false;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1] === 'graphql') reviewReceived = true;
    if (args[1]?.endsWith('/status')) {
      if (reviewReceived) scenario.cancellation.abort();
      return JSON.stringify({
        sha: head,
        total_count: 1,
        statuses: [
          { context: 'CI', state: reviewReceived ? 'pending' : 'success', target_url: null },
        ],
      });
    }
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
});

test('equal-count reruns with ambiguous same-name jobs stay ineligible', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/actions/runs/7/jobs?'))
      return workflowJobs([
        [99, 1],
        [1, 1],
        [42, 2],
        [43, 2],
      ]);
    if (!args[1]?.includes('/check-runs?')) return readyResponse(args);
    const prior = JSON.parse(ambiguousJobChecks()).check_runs as unknown[];
    return JSON.stringify({
      total_count: 4,
      check_runs: [
        ...prior,
        {
          ...successfulRun,
          id: 43,
          details_url: 'https://github.com/example/project/actions/runs/7/job/43',
        },
      ],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
    message: /ambiguous same-name jobs/,
  });
});

test('a check rerun queued during review cannot authorize delivery', async (t) => {
  let reviewReceived = false;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1] === 'graphql') reviewReceived = true;
    if (reviewReceived && args[1]?.includes('/check-runs?')) {
      return JSON.stringify({
        total_count: 1,
        check_runs: [{ ...successfulRun, status: 'queued', conclusion: null }],
      });
    }
    if (reviewReceived && args[1]?.endsWith('/status')) scenario.cancellation.abort();
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
});

test('ref and suite observations for the same check cannot disagree', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.includes('/commits/') && args[1].includes('/check-runs?'))
      return JSON.stringify({
        total_count: 1,
        check_runs: [{ ...successfulRun, status: 'in_progress', conclusion: null }],
      });
    return suiteResponse(args, (id) => (id === '1' ? successfulRun : undefined));
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.match(error.message, /ref and suite disagree/);
    assert.deepEqual(error.observation.checks?.map((check) => check.status).sort(), [
      'COMPLETED',
      'IN_PROGRESS',
    ]);
    return true;
  });
});

test('missing, rejected or raced review facts cannot authorize a pull request', async (t) => {
  for (const [decision, message] of [
    [{ ...review, reviewDecision: undefined }, /review decision unavailable/],
    [{ ...review, reviewDecision: 'CHANGES_REQUESTED' }, /review requested changes/],
    [{ ...review, headRefOid: 'f'.repeat(40) }, /changed during review observation/],
  ] as const) {
    const scenario = new ProviderResults(t, (args) =>
      args[1] === 'graphql'
        ? JSON.stringify({ data: { repository: { pullRequest: decision } } })
        : readyResponse(args),
    );
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { message });
  }
});

test('an incomplete check or required review stays pending until cancellation', async (t) => {
  for (const pending of ['check', 'review']) {
    const scenario = new ProviderResults(t, (args) => {
      if (pending === 'check' && args[1]?.includes('/check-runs?'))
        return JSON.stringify({
          total_count: 1,
          check_runs: [{ ...successfulRun, status: 'queued', conclusion: null }],
        });
      if (args[1] === 'graphql') {
        scenario.cancellation.abort();
        const decision = pending === 'review' ? 'REVIEW_REQUIRED' : null;
        return JSON.stringify({
          data: { repository: { pullRequest: { ...review, reviewDecision: decision } } },
        });
      }
      return readyResponse(args);
    });
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
  }
});
