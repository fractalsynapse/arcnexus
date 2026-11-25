import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { GitHub } from '../../src/index.js';

/** Exercise public provider operations while replacing only external command transport. */
export class ProviderResults {
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

export const repository = 'repos/example/project';
export const pr = 'https://github.com/example/project/pull/99';
export const head = 'a'.repeat(40);
const restPull = {
  html_url: pr,
  number: 99,
  head: { sha: head, ref: '1-task', repo: { full_name: 'example/project' } },
  base: { ref: 'staging', repo: { full_name: 'example/project' } },
  state: 'open',
  merged_at: null,
  merge_commit_sha: 'b'.repeat(40),
};
export const review = {
  state: 'OPEN',
  headRefOid: head,
  baseRefName: 'staging',
  reviewDecision: null,
};
export const successfulRun = {
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

export function readyResponse(args: string[]) {
  switch (args[1]) {
    case repository + '/pulls/99':
      return JSON.stringify(restPull);
    case repository + '/commits/' + head + '/check-suites':
      return JSON.stringify({ total_count: 1, check_suites: [{ id: 5, head_sha: head }] });
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

export function workflowJobs(attempts: [id: number, attempt: number][]) {
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

export function completingSuite(conclusion: 'success' | 'failure') {
  let inventories = 0;
  return (args: string[]) => {
    if (args[1]?.endsWith('/check-suites')) return suiteState(++inventories > 1);
    if (args[1]?.includes('/check-runs?')) {
      const completed = inventories > 1;
      const check = {
        ...successfulRun,
        check_suite: { id: 5 },
        status: completed ? 'completed' : 'in_progress',
        conclusion: completed ? conclusion : null,
      };
      return JSON.stringify({ total_count: 1, check_runs: [check] });
    }
    if (args[1]?.endsWith('/jobs/42/logs')) return 'Retained actual failure';
    return readyResponse(args);
  };
}

function suiteState(completed: boolean) {
  const suite = {
    id: 5,
    head_sha: head,
    latest_check_runs_count: 1,
    status: completed ? 'completed' : 'in_progress',
    updated_at: completed ? '2026-11-24T00:01:00Z' : '2026-11-24T00:00:00Z',
  };
  return JSON.stringify({ total_count: 1, check_suites: [suite] });
}
