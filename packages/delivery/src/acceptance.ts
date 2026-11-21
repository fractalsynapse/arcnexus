import { isDeepStrictEqual } from 'node:util';
import type { HostTask } from '../../execution/src/index.js';
import {
  validateVerdict,
  verificationIdentity,
  type Candidate,
  type Verdict,
  type VerificationIdentity,
} from '../../verification/src/index.js';
import type { Publication } from './publication.js';

interface Assessment {
  identity: VerificationIdentity;
  checks: Awaited<ReturnType<HostTask['check']>>[];
}

export interface PublicationHistory {
  publication?: Publication;
  verification?: Assessment;
  candidate?: Candidate;
  verdict?: Verdict;
}

/** Bind publication to the captured plan, actual check observations and independent verdict. */
export function acceptedIdentity(
  task: HostTask,
  candidate: Candidate,
  verdict: Extract<Verdict, { kind: 'accepted' }>,
) {
  const plan = task.history().findLast((event) => 'plan' in event)?.plan;
  const assessment = task
    .observations<{ verification?: Assessment }>()
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

/** Require fresh assessment when retained publication no longer matches the current capture. */
export function currentAcceptance(task: HostTask, digest: string, identity?: VerificationIdentity) {
  const accepted = task.history().findLast((event) => 'verdict' in event);
  if (!identity || accepted?.verdict.kind !== 'accepted' || accepted.candidate.digest !== digest)
    return false;
  try {
    return isDeepStrictEqual(
      identity,
      acceptedIdentity(task, accepted.candidate, accepted.verdict),
    );
  } catch (error) {
    task.note({ publicationReconciliation: { reason: String(error), identity } });
    return false;
  }
}

/** Preserve historical approval only as evidence for the exact retained publication. */
export function validateRetainedAcceptance(
  publication: Publication,
  events: readonly PublicationHistory[],
) {
  const identity = publication.verification;
  const accepted = events.findLast(
    (event) =>
      event.verdict?.kind === 'accepted' &&
      event.verdict.candidate === publication.candidate &&
      event.candidate?.digest === publication.candidate &&
      isDeepStrictEqual(event.verdict.verification, identity),
  );
  const assessment = events.findLast((event) =>
    isDeepStrictEqual(event.verification?.identity, identity),
  )?.verification;
  if (
    !identity ||
    !accepted ||
    !assessment ||
    identity.tree !== publication.candidate ||
    identity.base !== publication.parent ||
    assessment.checks.some(({ status, diagnostic }) => status !== 0 || diagnostic)
  )
    throw new Error('The retained publication has no matching accepting verification identity');
}
