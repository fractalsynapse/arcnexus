import type { ProviderCheck } from './check-failure.js';
import type { ProviderCheckSuite } from './github-checks.js';

export interface ProviderCISnapshot {
  checks: readonly ProviderCheck[];
  suites: readonly ProviderCheckSuite[];
}

export function suiteSnapshot(suites: readonly ProviderCheckSuite[]) {
  return JSON.stringify(suites.toSorted((a, b) => a.id - b.id));
}

/** Retain each observed suite and its expected run coverage across separate reads. */
export function requireRetainedSuites(
  observed: readonly ProviderCheckSuite[],
  previous: readonly ProviderCheckSuite[] = [],
) {
  const current = new Map(observed.map((suite) => [suite.id, suite]));
  for (const suite of previous) {
    const retained = current.get(suite.id);
    if (!retained) throw new Error('GitHub omitted a previously observed check suite');
    if ((retained.latest_check_runs_count ?? 0) < (suite.latest_check_runs_count ?? 0))
      throw new Error(`GitHub suite ${suite.id} lost previously observed check run coverage`);
  }
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
