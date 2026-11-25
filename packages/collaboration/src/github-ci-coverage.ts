import type { ProviderCheck } from './check-failure.js';
import type { ProviderCheckSuite } from './github-checks.js';
import type { GitHubPullObservation } from './github-pull.js';

export interface ProviderCISnapshot {
  checks: readonly ProviderCheck[];
  suites: readonly ProviderCheckSuite[];
}

export interface CIProgress {
  suites: Set<number>;
  intermediate: ProviderCISnapshot[];
  failure?: ProviderCheck;
}

export interface ProviderCIRead extends ProviderCISnapshot {
  observedChecks: readonly ProviderCheck[];
  progress: CIProgress;
}

export interface CIObserver {
  checks(checks: readonly ProviderCheck[]): void;
  observedChecks(checks: readonly ProviderCheck[]): void;
  suites(suites: readonly ProviderCheckSuite[], read: 'initial' | 'subsequent'): void;
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

export function pendingSuiteIds(suites: readonly ProviderCheckSuite[]) {
  return suites.filter(suitePending).map(({ id }) => id);
}

/** Reread when a completed suite restarts or an active suite advances. */
export function suiteProgress(
  previous: ProviderCheckSuite[],
  current: ProviderCheckSuite[],
  checks: readonly ProviderCheck[],
) {
  if (!hasCIObservations({ checks, suites: previous })) return current.map(({ id }) => id);
  if (previous.length !== current.length) return;
  const byId = new Map(current.map((item) => [item.id, item]));
  const progressed: number[] = [];
  for (const before of previous) {
    const after = byId.get(before.id);
    if (!after) return;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    if (!suiteAdvanced(before, after)) return;
    progressed.push(before.id);
  }
  return progressed;
}

function suiteAdvanced(before: ProviderCheckSuite, after: ProviderCheckSuite) {
  const oldCount = before.latest_check_runs_count ?? 0;
  const newCount = after.latest_check_runs_count ?? 0;
  if (newCount < oldCount) return false;
  if (before.status === 'completed') return suitePending(after);
  if (!suitePending(before)) return false;
  return (
    after.status === 'completed' ||
    (before.status !== 'in_progress' && after.status === 'in_progress') ||
    (after.status === 'queued' && before.status !== 'queued' && before.status !== 'in_progress') ||
    (before.status === after.status && newCount > oldCount)
  );
}

/** Identify an explicit provider suite failure even when no job was created. */
export function suiteFailure(
  observation: ProviderCheckSuite,
): observation is ProviderCheckSuite & { conclusion: string } {
  const { status, conclusion } = observation;
  return status === 'completed' && Boolean(conclusion && conclusion !== 'success');
}

export function suiteSnapshot(suites: readonly ProviderCheckSuite[]) {
  return JSON.stringify(suites.toSorted((a, b) => a.id - b.id));
}

function checkSnapshot(
  snapshot: ProviderCISnapshot,
  progressed?: ReadonlySet<number>,
  includeResults = true,
) {
  const checks = snapshot.checks
    .filter(({ suiteId }) => suiteId == null || !progressed?.has(suiteId))
    .map((check) =>
      JSON.stringify(
        includeResults
          ? check
          : { ...check, status: undefined, conclusion: undefined, state: undefined },
      ),
    )
    .sort();
  const suites = snapshot.suites.filter(({ id }) => !progressed?.has(id));
  return JSON.stringify([checks, suiteSnapshot(suites)]);
}

/** Pending results can advance while coverage outside the observed suites stays pinned. */
export function confirmationChanged(
  initial: ProviderCIRead,
  confirmed: ProviderCIRead,
  includeResults: boolean,
) {
  const { suites: progressed, intermediate } = confirmed.progress;
  const view = (snapshot: ProviderCISnapshot) =>
    checkSnapshot(snapshot, progressed, includeResults);
  const raw = ({ observedChecks: checks, suites }: ProviderCIRead) => ({ checks, suites });
  const prior = view(raw(initial));
  return (
    view(initial) !== view(confirmed) ||
    view(raw(confirmed)) !== prior ||
    intermediate.some((read) => view(read) !== prior)
  );
}

/** Retain distinct raw CI observations even when a later poll is unavailable. */
export function recordEarlierChecks(
  evidence: GitHubPullObservation,
  phase: 'CI checks' | 'CI confirmation',
  snapshot: ProviderCISnapshot,
) {
  const earlier = evidence.earlierChecks ?? [];
  const previous = earlier.findLast((item) => item.phase === phase);
  if (!previous || checkSnapshot(previous) !== checkSnapshot(snapshot))
    evidence.earlierChecks = [...earlier, { phase, ...snapshot }];
}

/** Preserve both sides of a completed CI read when verification must poll again. */
export function recordPolledChecks(evidence: GitHubPullObservation) {
  const count = evidence.earlierChecks?.length ?? 0;
  const { observedChecks, suites, confirmedObservedChecks, confirmedSuites } = evidence;
  if (observedChecks && suites)
    recordEarlierChecks(evidence, 'CI checks', { checks: observedChecks, suites });
  if (confirmedObservedChecks && confirmedSuites)
    recordEarlierChecks(evidence, 'CI confirmation', {
      checks: confirmedObservedChecks,
      suites: confirmedSuites,
    });
  return count !== (evidence.earlierChecks?.length ?? 0);
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
    const priorCount = suite.latest_check_runs_count ?? 0;
    const currentCount = retained.latest_check_runs_count ?? 0;
    if (currentCount < priorCount)
      throw new Error(`GitHub suite ${suite.id} lost previously observed check run coverage`);
    if (
      currentCount > priorCount &&
      suite.status === 'completed' &&
      retained.status === 'completed'
    )
      throw new Error(
        `A completed GitHub suite ${suite.id} changed its reported check run coverage`,
      );
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

/** Refuse runs that name a suite absent from the pinned provider inventory. */
export function requireRunSuites(
  runs: readonly { id: number; check_suite?: { id: number } | null }[],
  suites: readonly ProviderCheckSuite[],
) {
  const known = new Set(suites.map(({ id }) => id));
  for (const { id, check_suite } of runs)
    if (check_suite && !known.has(check_suite.id))
      throw new Error(`GitHub check run ${id} belongs to unlisted check suite ${check_suite.id}`);
}

export function successfulChecks(
  snapshot: ProviderCISnapshot & { pendingSuites: readonly number[] },
) {
  const { checks, pendingSuites } = snapshot;
  return (
    pendingSuites.length === 0 &&
    !snapshot.suites.some(suiteFailure) &&
    checks.length > 0 &&
    checks.every(
      ({ status, conclusion, state }) =>
        (status === 'COMPLETED' && conclusion === 'SUCCESS') || state === 'SUCCESS',
    )
  );
}

/** Keep unresolved run associations from turning incomplete reruns into terminal failures. */
function terminalCheckFailure(check: ProviderCheck, pendingSuites: readonly number[]) {
  const { state, status, conclusion, suiteId } = check;
  if (state) return ['ERROR', 'FAILURE'].includes(state);
  const suiteKnown =
    suiteId == null ? pendingSuites.length === 0 : !pendingSuites.includes(suiteId);
  return suiteKnown && status === 'COMPLETED' && conclusion !== 'SUCCESS';
}

/** Translate a provider suite failure into a check diagnostic without inventing a job. */
function terminalSuiteFailure(suites: readonly ProviderCheckSuite[]): ProviderCheck | undefined {
  const suite = suites.find(suiteFailure);
  if (!suite) return;
  return { suiteId: suite.id, status: 'COMPLETED', conclusion: suite.conclusion.toUpperCase() };
}

/** Distinguish a terminal observation from a previous job in a suite that is still running. */
export function observedCIFailure(snapshot: ProviderCISnapshot) {
  const pending = pendingSuiteIds(snapshot.suites);
  return (
    snapshot.checks.find((check) => terminalCheckFailure(check, pending)) ??
    terminalSuiteFailure(snapshot.suites)
  );
}

/** Return the provider's actual suite at the time it failed, including across CI rereads. */
export function failedSuiteDiagnostic(evidence: GitHubPullObservation, check: ProviderCheck) {
  if (check.runId !== undefined || check.suiteId == null) return;
  const suites = [
    evidence.confirmedSuites,
    evidence.suites,
    ...(evidence.earlierChecks ?? []).map(({ suites }) => suites),
  ];
  return suites
    .flat()
    .find(
      (suite) =>
        suite &&
        suite.id === check.suiteId &&
        suiteFailure(suite) &&
        suite.conclusion.toUpperCase() === check.conclusion,
    );
}
