import type { Plan, Rejection } from '../../direction/src/index.js';

export interface Candidate {
  digest: string;
  evidence: readonly string[];
}

export type Verdict =
  | {
      kind: 'accepted';
      candidate: string;
      criteria: readonly string[];
      evidence: readonly string[];
    }
  | { kind: 'rejected'; candidate: string; findings: readonly Rejection[] }
  | { kind: 'blocked'; reason: string; evidence: readonly string[] };

/** Reject a verdict that does not bind to the assembled candidate and its acceptance. */
export function validateVerdict(plan: Plan, candidate: Candidate, verdict: Verdict) {
  if (verdict.kind === 'blocked') return;
  if (candidate.digest !== verdict.candidate)
    throw new Error('Reviewer verdict refers to a different candidate');
  const criteria = new Map(
    plan.milestones.flatMap(({ owner, criteria }) =>
      criteria.map(({ id }) => [id, owner] as const),
    ),
  );
  if (verdict.kind === 'accepted') {
    const accepted = new Set(verdict.criteria);
    if (accepted.size !== criteria.size || [...accepted].some((id) => !criteria.has(id)))
      throw new Error('Reviewer verdict does not cover the complete acceptance');
    return;
  }
  if (
    !verdict.findings.length ||
    verdict.findings.some(
      (finding) =>
        criteria.get(finding.criterion) !== finding.owner ||
        !finding.evidence.length ||
        !finding.reason.trim(),
    )
  )
    throw new Error('Reviewer rejection must name known criteria, owners and evidence');
}

export { verify } from './native.js';
