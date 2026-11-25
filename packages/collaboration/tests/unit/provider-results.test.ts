import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GitHub, GitHubCheckFailure, GitHubPullReadFailure } from '../../src/index.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['delivery'] } as const;

/** Exercise public provider operations while replacing only external command transport. */
class ProviderResults {
  readonly calls: string[][] = [];
  readonly cancellation = new AbortController();
  readonly provider: GitHub;

  /** Retain actual command inputs and supply explicit provider-page fixtures. */
  constructor(
    t: TestContext,
    result: (args: string[]) => string,
    remote = 'https://github.com/example/project.git',
  ) {
    this.provider = new GitHub(remote, this.cancellation.signal);
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

const repository = 'repos/example/project';
const pr = 'https://github.com/example/project/pull/99';
const head = 'a'.repeat(40);
const restPull = {
  html_url: pr,
  number: 99,
  head: { sha: head, ref: '1-task', repo: { full_name: 'example/project' } },
  base: { ref: 'staging', repo: { full_name: 'example/project' } },
  state: 'open',
  merged_at: null,
  merge_commit_sha: 'b'.repeat(40),
};
const review = { state: 'OPEN', headRefOid: head, baseRefName: 'staging', reviewDecision: null };
const successfulRun = {
  id: 42,
  app: { id: 8, slug: 'github-actions' },
  name: 'Repository checks',
  status: 'completed',
  conclusion: 'success',
  head_sha: head,
  started_at: '2026-11-24T00:00:00Z',
  completed_at: '2026-11-24T00:01:00Z',
  details_url: 'https://github.com/example/project/actions/runs/7/job/42',
};

function readyResponse(args: string[]) {
  switch (args[1]) {
    case repository + '/pulls/99':
      return JSON.stringify(restPull);
    case repository + '/commits/' + head + '/check-suites':
      return JSON.stringify({ total_count: 1 });
    case repository + '/commits/' + head + '/check-runs?filter=latest':
    case repository + '/commits/' + head + '/check-runs?filter=all':
      return JSON.stringify({ total_count: 1, check_runs: [successfulRun] });
    case repository + '/commits/' + head + '/status':
      return JSON.stringify({ sha: head, status: 'pending', total_count: 0, statuses: [] });
    case repository + '/actions/jobs/1/logs':
    case repository + '/actions/jobs/99/logs':
      return 'Retained exact CI failure';
    case repository + '/actions/runs/7/jobs?filter=all':
      return workflowJobs([
        [99, 1],
        [1, 2],
      ]);
    case 'graphql':
      return JSON.stringify({ data: { repository: { pullRequest: review } } });
    default:
      assert.fail(`Unexpected provider command ${args.join(' ')}`);
  }
}

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

test('unavailable suite metadata retains the completed ref check read', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/check-suites')) throw new Error('Suite inventory unavailable');
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert.ok(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.checks?.[0]?.runId, successfulRun.id);
    return true;
  });
});

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
  const match = /\/check-suites\/(\d+)\/check-runs/.exec(args[1] ?? '');
  if (!match?.[1]) return readyResponse(args);
  const check = resolve(match[1]);
  return JSON.stringify({ total_count: check ? 1 : 0, check_runs: check ? [check] : [] });
}

function workflowJobs(attempts: [id: number, attempt: number][]) {
  return JSON.stringify({
    total_count: attempts.length,
    jobs: attempts.map(([id, run_attempt]) => ({
      id,
      run_attempt,
      head_sha: head,
      check_run_url: `https://api.github.com/${repository}/check-runs/${id}`,
    })),
  });
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

test('a failed pinned check carries the complete provider job log without trimming', async (t) => {
  const log = '\nComplete provider log\n  actual assertion failure\nfinal conclusion\n\n';
  const check = {
    runId: 42,
    appId: 8,
    name: 'Repository checks',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/example/project/actions/runs/7/job/42',
  };
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
    assert.deepEqual(error.check, check);
    assert.equal(error.log, log);
    return true;
  });
  assert.deepEqual(scenario.calls.at(-1), ['api', 'repos/example/project/actions/jobs/42/logs']);
});
