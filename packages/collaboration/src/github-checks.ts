import { z } from 'zod';
import type { ProviderCheck } from './check-failure.js';

type Read = (args: string[]) => Promise<string>;

const total = z.object({ total_count: z.int().nonnegative() });
const suite = z.object({ id: z.int().positive(), head_sha: z.string() });
const run = z.object({
  id: z.int().positive(),
  app: z.object({ id: z.int().positive() }).nullable(),
  completed_at: z.iso.datetime().nullable().optional(),
  head_sha: z.string(),
  name: z.string().min(1),
  status: z.enum(['completed', 'in_progress', 'queued', 'requested', 'waiting', 'pending']),
  conclusion: z
    .enum([
      'action_required',
      'cancelled',
      'failure',
      'neutral',
      'skipped',
      'stale',
      'startup_failure',
      'success',
      'timed_out',
    ])
    .nullable(),
  details_url: z.string().nullable(),
});
const status = z.object({
  context: z.string().min(1),
  state: z.enum(['error', 'failure', 'pending', 'success']),
  target_url: z.string().nullable(),
});
const runPage = total.extend({ check_runs: z.array(run) });
const suitePage = total.extend({ check_suites: z.array(suite) });
const statusPage = total.extend({ sha: z.string(), statuses: z.array(status) });

// GitHub's ref endpoint searches only its most recent check suites past this provider ceiling.
const gitHubRefCheckSuiteCoverage = 1000;

/** Read both CI sources against the same pinned SHA before considering delivery eligible. */
export async function readGitHubChecks(
  read: Read,
  repository: string,
  head: string,
  observe: (checks: readonly ProviderCheck[]) => void,
): Promise<ProviderCheck[]> {
  const repo = `repos/${repository}`;
  const ref = `${repo}/commits/${head}`;
  const runs = await checkRuns(read, repo, ref, head);
  const checks = runs.map(({ id, app, name, status, conclusion, details_url }) => ({
    runId: id,
    appId: app?.id,
    name,
    status: status.toUpperCase(),
    conclusion: conclusion?.toUpperCase(),
    detailsUrl: details_url ?? undefined,
  }));
  observe(checks);
  return [...checks, ...(await legacyStatuses(read, ref, head))];
}

/** Decode the latest legacy contexts and verify every page belongs to the selected head. */
async function legacyStatuses(read: Read, ref: string, head: string) {
  const statuses = await decodePages(read, `${ref}/status`, statusPage);
  if (statuses.some((page) => page.sha !== head))
    throw new Error('GitHub returned commit statuses for a different head');
  return complete(
    statuses,
    (page) => page.statuses,
    (item) => item.context,
  ).map(({ context, state, target_url }) => ({
    context,
    state: state.toUpperCase(),
    detailsUrl: target_url ?? undefined,
  }));
}

/** Use GitHub's latest view for ordinary refs and enumerate suites when its coverage is limited. */
async function checkRuns(read: Read, repo: string, ref: string, head: string) {
  const current = await runsFrom(read, `${ref}/check-runs?filter=latest`, head);
  const count = total.parse(JSON.parse(await read(['api', `${ref}/check-suites`]))).total_count;
  if (count <= gitHubRefCheckSuiteCoverage) return current;

  const pages = await decodePages(read, `${ref}/check-suites`, suitePage);
  const suites = complete(
    pages,
    (page) => page.check_suites,
    (item) => item.id,
  );
  if (suites.length < count) throw new Error('GitHub returned an incomplete check suite inventory');
  const contexts = new Map<string, z.output<typeof run>[]>();
  for (const suite of suites) {
    if (suite.head_sha !== head)
      throw new Error('GitHub returned a check suite for a different head');
    const runs = await runsFrom(
      read,
      `${repo}/check-suites/${suite.id}/check-runs?filter=latest`,
      head,
    );
    for (const item of runs) {
      const key = runContext(item);
      const group = contexts.get(key) ?? [];
      group.push(item);
      contexts.set(key, group);
    }
  }
  return [...contexts.values()].flatMap(latestInContext);
}

function runContext(item: z.output<typeof run>) {
  return item.app ? JSON.stringify([item.app.id, item.name]) : JSON.stringify([null, item.id]);
}

/** Compare provider completion times across suites and keep pending observations visible. */
function latestInContext(runs: z.output<typeof run>[]) {
  const pending = runs.filter((item) => item.status !== 'completed');
  if (pending.length) return pending;
  const latest = runs.reduce((time, item) => {
    return item.completed_at ? Math.max(time, Date.parse(item.completed_at)) : time;
  }, -Infinity);
  return runs.filter((item) => !item.completed_at || Date.parse(item.completed_at) === latest);
}

async function runsFrom(read: Read, endpoint: string, head: string) {
  const pages = await decodePages(read, endpoint, runPage);
  const runs = complete(
    pages,
    (page) => page.check_runs,
    (item) => item.id,
  );
  if (runs.some((item) => item.head_sha !== head))
    throw new Error('GitHub returned check runs for a different head');
  return runs;
}

/** Retain each provider page's metadata for completeness and identity checks. */
async function decodePages<T>(read: Read, endpoint: string, schema: z.ZodType<T>) {
  const response = await read(['api', endpoint, '--paginate', '--jq', 'tojson']);
  return response
    .split('\n')
    .filter(Boolean)
    .map((line) => schema.parse(JSON.parse(line)));
}

function complete<P extends { total_count: number }, T>(
  pages: P[],
  items: (page: P) => T[],
  identity: (item: T) => number | string,
) {
  const values = pages.flatMap(items);
  if (
    pages.length === 0 ||
    pages.some(({ total_count }) => total_count !== values.length) ||
    new Set(values.map(identity)).size !== values.length
  )
    throw new Error('GitHub returned incomplete or inconsistent CI pages');
  return values;
}
