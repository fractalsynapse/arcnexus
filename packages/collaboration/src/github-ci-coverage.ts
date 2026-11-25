import type { ProviderCheck } from './check-failure.js';
import type { ProviderCheckSuite } from './github-checks.js';
import type { GitHubPullObservation } from './github-pull.js';

export interface ProviderCISnapshot {
  checks: readonly ProviderCheck[];
  suites: readonly ProviderCheckSuite[];
}

export interface CIObserver {
  checks(checks: readonly ProviderCheck[]): void;
  observedChecks(checks: readonly ProviderCheck[]): void;
  suites(suites: readonly ProviderCheckSuite[]): void;
  earlier(checks: readonly ProviderCheck[], suites: readonly ProviderCheckSuite[]): void;
}

export const pendingCheckStatuses = [
  'in_progress',
  'queued',
  'requested',
  'waiting',
  'pending',
] as const;

function hasCIObservations(scope: ProviderCISnapshot) {
  return scope.suites.length > 0 || scope.checks.length > 0;
}

export function suitePending({ status }: ProviderCheckSuite) {
  return pendingCheckStatuses.some((pending) => pending === status);
}

/** Reread when an existing active suite advances or registers more expected runs. */
export function suiteProgress(
  previous: ProviderCheckSuite[],
  current: ProviderCheckSuite[],
  checks: readonly ProviderCheck[],
) {
  if (!hasCIObservations({ checks, suites: previous })) return true;
  if (previous.length !== current.length) return false;
  const byId = new Map(current.map((item) => [item.id, item]));
  return previous.every((before) => {
    const after = byId.get(before.id);
    if (!after) return false;
    if (JSON.stringify(before) === JSON.stringify(after)) return true;
    if (!suitePending(before)) return false;
    const oldCount = before.latest_check_runs_count ?? 0;
    const newCount = after.latest_check_runs_count ?? 0;
    if (newCount < oldCount) return false;
    return (
      after.status === 'completed' ||
      (before.status !== 'in_progress' && after.status === 'in_progress') ||
      (after.status === 'queued' &&
        before.status !== 'queued' &&
        before.status !== 'in_progress') ||
      (before.status === after.status && newCount > oldCount)
    );
  });
}

export function suiteSnapshot(suites: readonly ProviderCheckSuite[]) {
  return JSON.stringify(suites.toSorted((a, b) => a.id - b.id));
}

export function checkSnapshot(snapshot: ProviderCISnapshot) {
  const checks = snapshot.checks.map((check) => JSON.stringify(check)).sort();
  return JSON.stringify([checks, suiteSnapshot(snapshot.suites)]);
}

/** Retain distinct raw CI observations even when a later poll is unavailable. */
export function recordEarlierChecks(
  evidence: GitHubPullObservation,
  phase: 'CI checks' | 'CI confirmation',
  checks: readonly ProviderCheck[],
  suites: readonly ProviderCheckSuite[],
) {
  const earlier = (evidence.earlierChecks ??= []);
  const previous = earlier.findLast((item) => item.phase === phase);
  if (!previous || checkSnapshot(previous) !== checkSnapshot({ checks, suites }))
    earlier.push({ phase, checks, suites });
}

/** Retain each observed suite and its expected run coverage across separate reads. */
export function requireRetainedSuites(
  observed: readonly ProviderCheckSuite[],
  previous?: ProviderCISnapshot,
) {
  if (!previous || !hasCIObservations(previous)) return;
  const current = new Map(observed.map((suite) => [suite.id, suite]));
  for (const suite of previous.suites) {
    const retained = current.get(suite.id);
    if (!retained) throw new Error('GitHub omitted a previously observed check suite');
    if ((retained.latest_check_runs_count ?? 0) < (suite.latest_check_runs_count ?? 0))
      throw new Error(`GitHub suite ${suite.id} lost previously observed check run coverage`);
  }
  if (current.size !== previous.suites.length)
    throw new Error('GitHub check suite inventory changed between observations');
}

/** Validate run identities against provider history before choosing the current attempt. */
export function requireRetainedChecks(
  runs: readonly { id: number }[],
  statuses: readonly ProviderCheck[],
  previous: readonly ProviderCheck[],
) {
  const ids = new Set(runs.map(({ id }) => id));
  const contexts = new Set(statuses.map(({ context }) => context));
  for (const check of previous) {
    if (check.runId !== undefined && !ids.has(check.runId))
      throw new Error(`GitHub omitted previously observed check run ${check.runId}`);
    if (check.context !== undefined && !contexts.has(check.context))
      throw new Error(`GitHub omitted previously observed commit status ${check.context}`);
  }
}
