import { z } from 'zod';
import type { ProviderCheck } from './check-failure.js';

type Read = (args: string[]) => Promise<string>;

const total = z.object({ total_count: z.int().nonnegative() });
const suite = z.object({ id: z.int().positive(), head_sha: z.string() });
const run = z.object({
  id: z.int().positive(),
  app: z.object({ id: z.int().positive(), slug: z.string().optional() }).nullable(),
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
const job = z.object({
  id: z.int().positive(),
  run_attempt: z.int().positive(),
  head_sha: z.string(),
  check_run_url: z.string(),
});
const jobPage = total.extend({ jobs: z.array(job) });

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
  const checks = await checkRuns(read, repo, ref, head, observe);
  return [...checks, ...(await legacyStatuses(read, ref, head))];
}

function normalizeRun({ id, app, name, status, conclusion, details_url }: z.output<typeof run>) {
  return {
    runId: id,
    appId: app?.id,
    name,
    status: status.toUpperCase(),
    conclusion: conclusion?.toUpperCase(),
    detailsUrl: details_url ?? undefined,
  };
}

/** Decode the latest legacy contexts and verify every page belongs to the selected head. */
async function legacyStatuses(read: Read, ref: string, head: string) {
  const page = statusPage.refine(
    (value) => value.sha === head,
    'GitHub returned commit statuses for a different head',
  );
  const statuses = await readCollection(
    read,
    `${ref}/status`,
    page,
    (page) => page.statuses,
    (item) => item.context,
  );
  return statuses.map(({ context, state, target_url }) => ({
    context,
    state: state.toUpperCase(),
    detailsUrl: target_url ?? undefined,
  }));
}

type CheckRun = z.output<typeof run>;

/** Use the same attempt selection for refs with and without complete provider coverage. */
async function checkRuns(
  read: Read,
  repo: string,
  ref: string,
  head: string,
  observe: (checks: readonly ProviderCheck[]) => void,
) {
  const current = await runsFrom(read, `${ref}/check-runs?filter=all`, head);
  observe(current.map(normalizeRun));
  const count = total.parse(JSON.parse(await read(['api', `${ref}/check-suites`]))).total_count;
  const runs =
    count > gitHubRefCheckSuiteCoverage
      ? await suiteRuns(read, repo, ref, head, count, current, observe)
      : current;
  observe(runs.map(normalizeRun));
  const checks = (await latestRuns(read, repo, head, runs)).map(normalizeRun);
  observe(checks);
  return checks;
}

/** Enumerate the full suite inventory while preserving already read facts on a provider error. */
async function suiteRuns(
  read: Read,
  repo: string,
  ref: string,
  head: string,
  count: number,
  current: CheckRun[],
  observe: (checks: readonly ProviderCheck[]) => void,
) {
  const suites = await suiteInventory(read, ref, head, count);
  const runs = new Map<number, CheckRun>();
  try {
    for (const suite of suites) {
      const observed = await runsFrom(
        read,
        `${repo}/check-suites/${suite.id}/check-runs?filter=all`,
        head,
      );
      for (const run of observed) runs.set(run.id, run);
    }
  } catch (error) {
    for (const run of current) if (!runs.has(run.id)) runs.set(run.id, run);
    observe([...runs.values()].map(normalizeRun));
    throw error;
  }
  return [...runs.values()];
}

/** Require every collected suite to belong to the same head and coverage snapshot. */
async function suiteInventory(read: Read, ref: string, head: string, count: number) {
  const page = suitePage.refine(
    (value) => value.check_suites.every((item) => item.head_sha === head),
    'GitHub returned a check suite for a different head',
  );
  const suites = await readCollection(
    read,
    `${ref}/check-suites`,
    page,
    (page) => page.check_suites,
    (item) => item.id,
  );
  if (suites.length < count) throw new Error('GitHub returned an incomplete check suite inventory');
  return suites;
}

/** Use provider job attempts for Actions reruns and preserve other check identities. */
async function latestRuns(read: Read, repo: string, head: string, runs: CheckRun[]) {
  const contexts = new Map<string, { workflow?: string; runs: CheckRun[] }>();
  for (const run of runs) {
    const workflow = workflowRun(run, repo);
    const key = workflow ? JSON.stringify([workflow, run.name]) : String(run.id);
    const context = contexts.get(key) ?? { workflow, runs: [] };
    context.runs.push(run);
    contexts.set(key, context);
  }
  const known = new Map<string, Map<number, number>>();
  const selected: CheckRun[] = [];
  for (const { workflow, runs } of contexts.values()) {
    if (!workflow || runs.length === 1) {
      selected.push(...runs);
      continue;
    }
    const attempts = known.get(workflow) ?? (await workflowAttempts(read, repo, head, workflow));
    known.set(workflow, attempts);
    selected.push(...latestInContext(runs, attempts));
  }
  return selected;
}

/** Recognize Actions' own scoped job URL before using it to group attempts. */
function workflowRun(run: CheckRun, repo: string) {
  if (run.app?.slug !== 'github-actions' || !run.details_url) return;
  const action =
    /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/actions\/runs\/(\d+)\/job\/(\d+)$/.exec(
      run.details_url,
    );
  if (
    action?.[1]?.toLowerCase() === repo.slice('repos/'.length).toLowerCase() &&
    action?.[3] === String(run.id)
  )
    return action[2];
}

/** Bind each workflow job to the same head and the provider's exact check-run identity. */
async function workflowAttempts(read: Read, repo: string, head: string, workflow: string) {
  const page = jobPage.refine(
    (value) =>
      value.jobs.every(
        (job) =>
          job.head_sha === head &&
          job.check_run_url.toLowerCase() ===
            `https://api.github.com/${repo}/check-runs/${job.id}`.toLowerCase(),
      ),
    'GitHub returned a workflow job outside the pinned check scope',
  );
  const jobs = await readCollection(
    read,
    `${repo}/actions/runs/${workflow}/jobs?filter=all`,
    page,
    (result) => result.jobs,
    (job) => job.id,
  );
  return new Map(jobs.map((job) => [job.id, job.run_attempt]));
}

/** Keep distinct jobs in the latest attempt, even when their display names collide. */
function latestInContext(runs: CheckRun[], attempts: Map<number, number>) {
  const numbers = runs.map((item) => attempts.get(item.id));
  if (numbers.some((number) => number === undefined))
    throw new Error('GitHub did not identify every check run attempt');
  const latest = numbers.reduce<number>((latest, number) => Math.max(latest, number ?? 0), 0);
  return runs.filter((item) => attempts.get(item.id) === latest);
}

async function runsFrom(read: Read, endpoint: string, head: string) {
  const page = runPage.refine(
    (value) => value.check_runs.every((item) => item.head_sha === head),
    'GitHub returned check runs for a different head',
  );
  return readCollection(
    read,
    endpoint,
    page,
    (page) => page.check_runs,
    (item) => item.id,
  );
}

/** Retain the original provider output when any collected page is invalid or incomplete. */
async function readCollection<P extends { total_count: number }, T>(
  read: Read,
  endpoint: string,
  schema: z.ZodType<P>,
  items: (page: P) => T[],
  identity: (item: T) => number | string,
) {
  const stdout = await read(['api', endpoint, '--paginate', '--jq', 'tojson']);
  try {
    const pages = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => schema.parse(JSON.parse(line)));
    return complete(pages, items, identity);
  } catch (cause) {
    const diagnostic = cause instanceof Error ? cause.message : String(cause);
    throw Object.assign(new Error(`GitHub read ${endpoint}: ${diagnostic}`, { cause }), { stdout });
  }
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
