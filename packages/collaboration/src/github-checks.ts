import { z } from 'zod';
import type { ProviderCheck } from './check-failure.js';
import { decodeGitHubResponse } from './read.js';

type Read = (args: string[]) => Promise<string>;

const total = z.object({ total_count: z.int().nonnegative() });
const suite = z.object({ id: z.int().positive(), head_sha: z.string() });
const run = z.object({
  id: z.int().positive(),
  app: z.object({ id: z.int().positive(), slug: z.string().optional() }).nullable(),
  check_suite: z.object({ id: z.int().positive() }).nullish(),
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
  const coverage = await read(['api', `${ref}/check-suites`]);
  const count = decodeGitHubResponse(
    coverage,
    'check suite coverage',
    () => total.parse(JSON.parse(coverage)).total_count,
  );
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
    if (current.some((run) => !runs.has(run.id)))
      throw new Error('GitHub suite inventory omitted an observed check');
  } catch (error) {
    for (const run of current) if (!runs.has(run.id)) runs.set(run.id, run);
    observe([...runs.values()].map(normalizeRun));
    throw error;
  }
  return [...runs.values()];
}

/** Require every collected suite to belong to the same head and coverage snapshot. */
async function suiteInventory(read: Read, ref: string, head: string, count: number) {
  const page = suitePage
    .refine(
      (value) => value.check_suites.every((item) => item.head_sha === head),
      'GitHub returned a check suite for a different head',
    )
    .refine(
      (value) => value.total_count >= count,
      'GitHub returned an incomplete check suite inventory',
    );
  const suites = await readCollection(
    read,
    `${ref}/check-suites`,
    page,
    (page) => page.check_suites,
    (item) => item.id,
  );
  return suites;
}

interface CheckContext {
  workflow?: string;
  suite?: number;
  runs: CheckRun[];
}

/** Prefer the provider's selection without joining independent check identities. */
async function latestRuns(read: Read, repo: string, head: string, checks: CheckRun[]) {
  const workflows = new Map<string, Map<number, number>>();
  const suites = new Map<number, Set<number>>();
  const selected: CheckRun[] = [];
  const checkIds = new Set(checks.map((check) => check.id));
  for (const { workflow, suite, runs } of checkContexts(repo, checks)) {
    if (runs.length === 1) {
      selected.push(...runs);
    } else if (workflow) {
      const attempts =
        workflows.get(workflow) ?? (await workflowAttempts(read, repo, head, workflow, checkIds));
      workflows.set(workflow, attempts);
      selected.push(...latestInContext(runs, attempts));
    } else if (suite !== undefined) {
      const ids = suites.get(suite) ?? (await latestSuiteIds(read, repo, head, suite, checkIds));
      suites.set(suite, ids);
      const latest = runs.filter((run) => ids.has(run.id));
      if (latest.length === 0)
        throw new Error(`GitHub did not identify the current checks for suite ${suite}`);
      selected.push(...latest);
    }
  }
  return selected;
}

/** Group independently identified checks by workflow or third-party suite and name. */
function checkContexts(repo: string, runs: CheckRun[]) {
  const contexts = new Map<string, CheckContext>();
  for (const run of runs) {
    const workflow = workflowRun(run, repo);
    const suite = run.app && run.app.slug !== 'github-actions' ? run.check_suite?.id : undefined;
    const key = workflow
      ? JSON.stringify(['workflow', workflow, run.name])
      : suite === undefined
        ? String(run.id)
        : JSON.stringify(['suite', run.app?.id, suite, run.name]);
    const context = contexts.get(key) ?? { workflow, suite, runs: [] };
    context.runs.push(run);
    contexts.set(key, context);
  }
  return contexts.values();
}

/** Read the third-party provider's latest check-run selection for its suite. */
async function latestSuiteIds(
  read: Read,
  repo: string,
  head: string,
  suite: number,
  checkIds: ReadonlySet<number>,
) {
  const latest = await runsFrom(
    read,
    `${repo}/check-suites/${suite}/check-runs?filter=latest`,
    head,
  );
  if (latest.some(({ id }) => !checkIds.has(id)))
    throw new Error('GitHub suite checks changed during CI observation');
  return new Set(latest.map((run) => run.id));
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
async function workflowAttempts(
  read: Read,
  repo: string,
  head: string,
  workflow: string,
  checkIds: ReadonlySet<number>,
) {
  const jobs = await readCollection(
    read,
    `${repo}/actions/runs/${workflow}/jobs?filter=all`,
    workflowJobScope(repo, head, checkIds),
    (result) => result.jobs,
    (job) => job.id,
  );
  return new Map(jobs.map((job) => [job.id, job.run_attempt]));
}

function workflowJobScope(repo: string, head: string, checkIds: ReadonlySet<number>) {
  return jobPage
    .refine(
      (value) =>
        value.jobs.every(
          (job) =>
            job.head_sha === head &&
            job.check_run_url.toLowerCase() ===
              `https://api.github.com/${repo}/check-runs/${job.id}`.toLowerCase(),
        ),
      'GitHub returned a workflow job outside the pinned check scope',
    )
    .refine(
      (value) => value.jobs.every(({ id }) => checkIds.has(id)),
      'GitHub workflow jobs changed during CI observation',
    );
}

/** Require unambiguous replacement when a workflow has several attempts. */
function latestInContext(runs: CheckRun[], attempts: Map<number, number>) {
  const counts = new Map<number, number>();
  let latest = 0;
  for (const run of runs) {
    const attempt = attempts.get(run.id);
    if (attempt === undefined) throw new Error('GitHub did not identify every check run attempt');
    counts.set(attempt, (counts.get(attempt) ?? 0) + 1);
    latest = Math.max(latest, attempt);
  }
  if (counts.size > 1 && [...counts.values()].some((count) => count > 1))
    throw new Error(`GitHub returned ambiguous same-name jobs across attempts: ${runs[0]?.name}`);
  return runs.filter((item) => attempts.get(item.id) === latest);
}

async function runsFrom(
  read: Read,
  endpoint: string,
  head: string,
  checkIds?: ReadonlySet<number>,
) {
  const page = runPage
    .refine(
      (value) => value.check_runs.every((item) => item.head_sha === head),
      'GitHub returned check runs for a different head',
    )
    .refine(
      (value) => !checkIds || value.check_runs.every(({ id }) => checkIds.has(id)),
      'GitHub suite checks changed during CI observation',
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
  return decodeGitHubResponse(stdout, endpoint, () => {
    const pages = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => schema.parse(JSON.parse(line)));
    return complete(pages, items, identity);
  });
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
