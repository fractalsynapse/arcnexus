import { isDeepStrictEqual } from 'node:util';
import type { HostTask } from '../../execution/src/index.js';
import {
  validateVerdict,
  verificationIdentity,
  type Candidate,
  type Verdict,
  type VerificationIdentity,
} from '../../verification/src/index.js';

interface Assessment {
  identity: VerificationIdentity;
  checks: Array<{ id: string; status: unknown; diagnostic?: string }>;
}

/** Bind publication to the captured plan, actual check observations and independent verdict. */
export function acceptedIdentity(
  task: HostTask,
  candidate: Candidate,
  verdict: Extract<Verdict, { kind: 'accepted' }>,
) {
  const plan = task.history().findLast((event) => 'plan' in event)?.plan;
  const assessment = task.observations<{ verification?: Assessment }>()
    .findLast((event) => event.verification)?.verification;
  if (!plan || !assessment || !verdict.verification)
    throw new Error('Delivery requires an accepting verdict with a verification identity');
  const identity = verificationIdentity(task, plan, candidate, assessment.checks);
  if (
    !isDeepStrictEqual(identity, assessment.identity) ||
    !isDeepStrictEqual(identity, verdict.verification) ||
    (candidate.verification && !isDeepStrictEqual(identity, candidate.verification)) ||
    !isDeepStrictEqual(
      assessment.checks.map(({ id }) => id),
      task.capture.project.checks?.acceptance ?? [],
    ) ||
    assessment.checks.some(({ status, diagnostic }) => status !== 0 || diagnostic)
  )
    throw new Error('Delivery verification identity or required checks changed');
  validateVerdict(plan, { ...candidate, verification: identity }, verdict);
  return identity;
}
