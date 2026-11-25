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

test('a suite still running does not report an earlier completed job as its final failure', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/check-suites'))
      return JSON.stringify({
        total_count: 1,
        check_suites: [{ id: 5, head_sha: head, status: 'queued', latest_check_runs_count: 2 }],
      });
    if (args[1]?.includes('/check-runs?')) {
      setImmediate(() => scenario.cancellation.abort());
      return JSON.stringify({
        total_count: 1,
        check_runs: [
          {
            ...successfulRun,
            check_suite: null,
            conclusion: 'failure',
          },
        ],
      });
    }
    if (args[1]?.endsWith('/jobs/42/logs')) return 'Earlier check failure';
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), { name: 'AbortError' });
});

test('an existing suite can register another check while it completes', async (t) => {
  const completing = completingSuite('success');
  let complete = false;
  const scenario = new ProviderResults(t, (args) => {
    const output = completing(args);
    if (args[1]?.endsWith('/check-suites')) {
      const result = JSON.parse(output);
      const suite = result.check_suites[0];
      complete = suite.status === 'completed';
      if (complete) suite.latest_check_runs_count = 2;
      return JSON.stringify(result);
    }
    if (!complete || !args[1]?.includes('/check-runs?')) return output;
    const result = JSON.parse(output);
    result.check_runs.push({ ...result.check_runs[0], id: 43, name: 'Lint' });
    return JSON.stringify({ ...result, total_count: 2 });
  });
  await scenario.provider.verify(pr, head, 'staging');
});

test('historical attempts cannot count toward the completed suite’s current coverage', async (t) => {
  const current = { ...successfulRun, app: { id: 9 }, check_suite: { id: 5 } };
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/check-suites'))
      return JSON.stringify({
        total_count: 1,
        check_suites: [{ id: 5, head_sha: head, status: 'completed', latest_check_runs_count: 2 }],
      });
    if (args[1]?.includes('/check-runs?filter=latest'))
      return JSON.stringify({ total_count: 1, check_runs: [current] });
    if (args[1]?.includes('/check-runs?filter=all'))
      return JSON.stringify({
        total_count: 2,
        check_runs: [{ ...current, id: 41, conclusion: 'failure' }, current],
      });
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), /missing check runs/);
});

test('suite metadata omissions cannot make an unseen suite eligible', async (t) => {
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
    return JSON.stringify({
      total_count: 1,
      check_suites: [{ id: 6, head_sha: head, status: 'completed' }],
    });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), /missing check runs/);
});

test('a check run with a suite missing from the pinned inventory cannot authorize integration', async (t) => {
  const scenario = new ProviderResults(t, (args) =>
    args[1]?.includes('/check-runs?')
      ? JSON.stringify({
          total_count: 1,
          check_runs: [{ ...successfulRun, check_suite: { id: 6 } }],
        })
      : readyResponse(args),
  );
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), /unlisted check suite/);
});

test('a pending suite must not disappear on the next verification poll', async (t) => {
  let pulls = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99')) pulls++;
    if (!args[1]?.endsWith('/check-suites') || pulls > 1) return readyResponse(args);
    const observed = JSON.parse(readyResponse(args));
    observed.check_suites.push({
      id: 6,
      head_sha: head,
      status: 'queued',
      latest_check_runs_count: 1,
    });
    return JSON.stringify({ total_count: 2, check_suites: observed.check_suites });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert(error instanceof GitHubPullReadFailure);
    assert.match(error.message, /previously observed check suite/);
    assert.match(JSON.stringify(error.observation), /"status":"queued"/);
    return true;
  });
});

for (const change of ['missing status', 'new suite']) {
  test(`a later poll with ${change} cannot authorize delivery`, async (t) => {
    let pulls = 0;
    const scenario = new ProviderResults(t, (args) => {
      if (args[1]?.endsWith('/pulls/99')) pulls++;
      if (args[1]?.includes('/check-runs?'))
        return JSON.stringify({
          total_count: 1,
          check_runs: [{ ...successfulRun, check_suite: { id: 5 } }],
        });
      if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
      const status = pulls === 1 ? 'queued' : change === 'missing status' ? undefined : 'completed';
      const suites = [{ id: 5, head_sha: head, status, latest_check_runs_count: 1 }];
      if (pulls > 1 && change === 'new suite')
        suites.push({ id: 6, head_sha: head, status: 'completed', latest_check_runs_count: 0 });
      return JSON.stringify({
        total_count: suites.length,
        check_suites: suites.map((suite) => ({
          ...suite,
          conclusion: suite.status === 'completed' ? 'success' : null,
        })),
      });
    });
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), {
      message: /missing check runs or completion status|check suite inventory changed/,
    });
  });
}

test('an observed legacy status pins the empty suite scope across polls', async (t) => {
  let pulls = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99')) pulls++;
    if (args[1]?.endsWith('/status'))
      return JSON.stringify({
        sha: head,
        total_count: 1,
        statuses: [{ context: 'CI', state: pulls === 1 ? 'pending' : 'success', target_url: null }],
      });
    if (pulls === 1 && args[1]?.endsWith('/check-suites'))
      return JSON.stringify({ total_count: 0, check_suites: [] });
    if (pulls === 1 && args[1]?.includes('/check-runs?'))
      return JSON.stringify({ total_count: 0, check_runs: [] });
    return readyResponse(args);
  });
  await assert.rejects(
    scenario.provider.verify(pr, head, 'staging'),
    /check suite inventory changed/,
  );
});

test('the first suite can appear before any CI facts have been observed', async (t) => {
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/check-suites') && ++inventories === 1)
      return JSON.stringify({ total_count: 0, check_suites: [] });
    if (inventories === 1 && args[1]?.includes('/check-runs?'))
      return JSON.stringify({ total_count: 0, check_runs: [] });
    return readyResponse(args);
  });
  await scenario.provider.verify(pr, head, 'staging');
});

test('a later poll cannot authorize a completed suite if its expected run count decreased', async (t) => {
  let pulls = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99')) pulls++;
    if (args[1]?.includes('/check-runs?'))
      return JSON.stringify({
        total_count: 1,
        check_runs: [{ ...successfulRun, check_suite: { id: 5 } }],
      });
    if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
    return JSON.stringify({
      total_count: 1,
      check_suites: [
        {
          id: 5,
          head_sha: head,
          status: pulls === 1 ? 'queued' : 'completed',
          conclusion: pulls === 1 ? null : 'success',
          latest_check_runs_count: pulls === 1 ? 2 : 1,
        },
      ],
    });
  });
  await assert.rejects(
    scenario.provider.verify(pr, head, 'staging'),
    /lost previously observed check run coverage/,
  );
});

test('a completed suite cannot acquire expected runs silently between polls', async (t) => {
  let pulls = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99')) pulls++;
    return completedSuiteGrowth(args, pulls === 1);
  });
  await assert.rejects(
    scenario.provider.verify(pr, head, 'staging'),
    /completed GitHub suite.*changed/,
  );
});

/** Expose extra green coverage only after an explicitly completed suite was observed. */
function completedSuiteGrowth(args: string[], initial: boolean) {
  if (args[1]?.endsWith('/status')) {
    const status = { context: 'CI', state: initial ? 'pending' : 'success', target_url: null };
    return JSON.stringify({ sha: head, total_count: 1, statuses: [status] });
  }
  if (args[1]?.endsWith('/check-suites')) {
    const suite = {
      id: 5,
      head_sha: head,
      status: 'completed',
      conclusion: 'success',
      latest_check_runs_count: initial ? 1 : 2,
    };
    return JSON.stringify({ total_count: 1, check_suites: [suite] });
  }
  if (args[1]?.includes('/check-runs?')) {
    const run = { ...successfulRun, check_suite: { id: 5 } };
    const runs = initial ? [run] : [run, { ...run, id: 43, name: 'Lint' }];
    return JSON.stringify({ total_count: runs.length, check_runs: runs });
  }
  return readyResponse(args);
}

test('the last actual poll governs growth when its log snapshot is a duplicate', async (t) => {
  let polls = 0;
  let reviewed = false;
  const scenario = new ProviderResults(t, (args) => {
    if (args[1]?.endsWith('/pulls/99')) polls++;
    if (args[1] === 'graphql') {
      reviewed = true;
      const response = readyResponse(args);
      return polls === 2
        ? response.replace('"reviewDecision":null', '"reviewDecision":"REVIEW_REQUIRED"')
        : response;
    }
    if (polls === 1 && reviewed && args[1]?.endsWith('/check-suites')) {
      const inventory = completedSuiteGrowth(args, true);
      return inventory.replace('"status":"completed"', '"status":"in_progress"');
    }
    if (args[1]?.endsWith('/status')) return readyResponse(args);
    return completedSuiteGrowth(args, polls < 3);
  });
  await assert.rejects(
    scenario.provider.verify(pr, head, 'staging'),
    /completed GitHub suite.*changed/,
  );
});

for (const activeAt of [1, 2]) {
  test(`observed new activity on inventory read ${activeAt} permits growth`, async (t) => {
    let polls = 0;
    let newInventories = 0;
    const scenario = new ProviderResults(t, (args) => {
      if (args[1]?.endsWith('/pulls/99')) polls++;
      if (args[1]?.endsWith('/status')) return readyResponse(args);
      if (polls === 1 && args[1] === 'graphql')
        return readyResponse(args).replace(
          '"reviewDecision":null',
          '"reviewDecision":"REVIEW_REQUIRED"',
        );
      if (polls > 1 && args[1]?.endsWith('/check-suites') && ++newInventories === activeAt)
        return completedSuiteGrowth(args, true)
          .replace('"status":"completed"', '"status":"in_progress"')
          .replace('"conclusion":"success"', '"conclusion":null');
      return completedSuiteGrowth(args, polls === 1 || newInventories <= activeAt);
    });
    await scenario.provider.verify(pr, head, 'staging');
    assert(newInventories > activeAt);
  });
}

function confirmedLegacyStatus(coverage: string, inventory: number) {
  const changed =
    (coverage === 'persistent status change' && inventory >= 4) ||
    (coverage === 'transient status change' && inventory === 4);
  const status = {
    context: 'CI',
    state: 'success',
    target_url: changed ? 'https://example.com/replaced' : null,
  };
  return JSON.stringify({ sha: head, total_count: 1, statuses: [status] });
}

for (const coverage of [
  'grows',
  'matches',
  'persistent status change',
  'transient status change',
]) {
  test(`a suite restarts during confirmation and coverage ${coverage}`, async (t) => {
    let inventories = 0;
    let reviews = 0;
    const scenario = new ProviderResults(t, (args) => {
      if (args[1] === 'graphql') reviews++;
      if (args[1]?.endsWith('/status')) return confirmedLegacyStatus(coverage, inventories);
      if (args[1]?.endsWith('/check-suites') && ++inventories === 4)
        return completedSuiteGrowth(args, true)
          .replace('"status":"completed"', '"status":"in_progress"')
          .replace('"conclusion":"success"', '"conclusion":null');
      return completedSuiteGrowth(args, inventories < 5 || coverage === 'matches');
    });
    if (coverage.endsWith('status change')) {
      await assert.rejects(
        scenario.provider.verify(pr, head, 'staging'),
        /CI changed during review/,
      );
      assert.equal(reviews, 1);
      return;
    }
    await scenario.provider.verify(pr, head, 'staging');
    assert.equal(reviews, 2);
  });
}

for (const reportedRuns of [undefined, 1]) {
  test(`polling cannot lose a visible check when the previous count was ${reportedRuns}`, async (t) => {
    let pulls = 0;
    const good = { ...successfulRun, check_suite: { id: 5 } };
    const bad = { ...good, id: 43, name: 'Lint', conclusion: 'failure' };
    const scenario = new ProviderResults(t, (args) => {
      if (args[1]?.endsWith('/pulls/99')) pulls++;
      if (args[1]?.includes('/check-runs?')) {
        const runs = pulls === 1 ? [good, bad] : [good];
        return JSON.stringify({ total_count: runs.length, check_runs: runs });
      }
      if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
      return JSON.stringify({
        total_count: 1,
        check_suites: [
          {
            id: 5,
            head_sha: head,
            status: pulls === 1 ? 'in_progress' : 'completed',
            latest_check_runs_count: pulls === 1 ? reportedRuns : 1,
          },
        ],
      });
    });
    await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (failure) => {
      assert(failure instanceof GitHubPullReadFailure);
      assert.match(failure.message, /omitted previously observed check run 43/);
      assert.equal(failure.observation.earlierChecks?.at(-1)?.checks[1]?.conclusion, 'FAILURE');
      return true;
    });
  });
}

test('CI confirmation retains all prior attempts after identifying a successful rerun', async (t) => {
  let reviewing = false;
  const current = { ...successfulRun, app: { id: 9 }, check_suite: { id: 5 } };
  const old = { ...current, id: 41, conclusion: 'failure' };
  const scenario = new ProviderResults(t, (args) => {
    if (args[1] === 'graphql') reviewing = true;
    if (args[1]?.includes('/check-runs?filter=latest'))
      return JSON.stringify({ total_count: 1, check_runs: [current] });
    if (args[1]?.includes('/check-runs?filter=all')) {
      const runs = reviewing ? [current] : [old, current];
      return JSON.stringify({ total_count: runs.length, check_runs: runs });
    }
    return readyResponse(args);
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (failure) => {
    assert(failure instanceof GitHubPullReadFailure);
    assert.equal(failure.read, 'CI confirmation');
    assert.match(failure.message, /omitted previously observed check run 41/);
    return true;
  });
});

test('a failed suite blocks delivery even when the provider supplies no job', async (t) => {
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/check-suites')) return readyResponse(args);
    const observed = JSON.parse(readyResponse(args));
    const completed = ++inventories > 1;
    observed.check_suites.push({
      id: 6,
      head_sha: head,
      status: completed ? 'completed' : 'queued',
      conclusion: completed ? 'startup_failure' : null,
      latest_check_runs_count: 0,
    });
    return JSON.stringify({ total_count: 2, check_suites: observed.check_suites });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert(error instanceof GitHubCheckFailure);
    assert.equal(error.check.suiteId, 6);
    assert.equal(error.check.conclusion, 'STARTUP_FAILURE');
    return true;
  });
});

test('an inconsistent inventory preserves the failed suite seen before the disagreement', async (t) => {
  let inventories = 0;
  const scenario = new ProviderResults(t, (args) => {
    if (!args[1]?.endsWith('/check-suites') || ++inventories !== 1) return readyResponse(args);
    const result = JSON.parse(readyResponse(args));
    result.check_suites.push({
      id: 6,
      head_sha: head,
      status: 'completed',
      conclusion: 'startup_failure',
      latest_check_runs_count: 0,
    });
    return JSON.stringify({ total_count: 2, check_suites: result.check_suites });
  });
  await assert.rejects(scenario.provider.verify(pr, head, 'staging'), (error) => {
    assert(error instanceof GitHubPullReadFailure);
    assert.equal(error.observation.earlierChecks?.[0]?.suites[1]?.conclusion, 'startup_failure');
    return true;
  });
});
