import type { HostTask } from './index.js';
import { git } from './git.js';

export interface VerifiedGoalRun {
  id: string;
  revision: string;
  tree: string;
  pull?: string;
  goalID: string;
  criteria: readonly string[];
  checks: readonly { operation: string; status: 0 }[];
}

interface RunEvent {
  artifact?: string;
  candidate?: { digest: string; unchanged?: boolean; evidence: readonly string[] };
  verdict?: { kind: string; candidate: string; criteria: readonly string[] };
  publication?: { candidate: string };
  outcome?: { kind: string; evidence: readonly string[] };
  check?: { id: string; status: number | null | 'not-applicable' };
  scope?: unknown;
}

/** Derive reusable observations from the verified delivery history for this exact tree. */
export function verifiedGoalRun(task: HostTask): VerifiedGoalRun | undefined {
  const { revision, root } = task.capture.source;
  const saved = task.journal.verifiedRun(revision);
  if (!saved) return;
  const events = saved.events as RunEvent[];
  const tree = git(root, 'rev-parse', `${revision}^{tree}`);
  const { accepted, pull } = acceptedTree(events, tree);
  const review = events[accepted];
  if (!review?.verdict || !review.candidate) return;
  const checks = candidateChecks(events.slice(0, accepted), review.candidate.evidence[0]);
  const required = task.capture.project.checks?.acceptance;
  if (!checks?.length || required?.some((id) => !checks.some(({ operation }) => id === operation)))
    return;
  return {
    id: saved.id,
    revision,
    tree,
    pull,
    goalID: saved.goalID,
    criteria: review.verdict.criteria,
    checks,
  };
}

/** Accept a citation only when it names an observation on the evaluated revision. */
export function citesVerifiedRun(
  value: unknown,
  run: VerifiedGoalRun | undefined,
  revision: string,
) {
  if (!run || run.revision !== revision || !value || typeof value !== 'object' || !('run' in value))
    return false;
  if (value.run !== run.id) return false;
  if ('operation' in value)
    return run.checks.some(({ operation }) => operation === value.operation);
  if ('criterion' in value) return run.criteria.some((criterion) => criterion === value.criterion);
  return 'delivery' in value && value.delivery === true && Boolean(run.pull);
}

/** Locate a matching accepted candidate, with observed publication for changed trees. */
function acceptedTree(events: readonly RunEvent[], tree: string) {
  const outcome = events.at(-1)?.outcome;
  const pull = outcome?.evidence.find((ref) => /^https:\/\/github\.com\/.+\/pull\/\d+$/.test(ref));
  const published = events.findLastIndex(({ publication }) => publication?.candidate === tree);
  const delivered = outcome?.kind === 'merged';
  if (delivered && (!pull || published < 0)) return { accepted: -1 };
  const accepted = events
    .slice(0, delivered ? published : -1)
    .findLastIndex(
      (event) =>
        event.candidate?.digest === tree &&
        (delivered || event.candidate.unchanged) &&
        event.verdict?.kind === 'accepted' &&
        event.verdict.candidate === tree,
    );
  return { accepted, pull };
}

/** Select checks from the accepted candidate's assembly through its review. */
function candidateChecks(events: readonly RunEvent[], artifact?: string) {
  if (!artifact) return;
  const assembled = events.findLastIndex((event) => event.artifact === artifact);
  if (assembled < 0) return;
  const checks = new Map<string, RunEvent['check']>();
  for (const event of events.slice(assembled + 1))
    if (event.check && !event.scope) checks.set(event.check.id, event.check);
  if ([...checks.values()].some((check) => check?.status !== 0)) return;
  return [...checks.keys()].map((operation) => ({ operation, status: 0 as const }));
}
