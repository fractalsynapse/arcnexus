import type { Agent } from '../../agent/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask, type HostTask } from '../../execution/src/index.js';
import { assess } from '../../reviewer/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Candidate, Verdict } from './index.js';

/** Run the captured acceptance checklist before an independent review. */
export async function verify(
  agent: Agent,
  session: TaskSession,
  plan: Plan,
  candidate: Candidate,
  signal: AbortSignal,
): Promise<Verdict> {
  const task = hostTask(session);
  const checks = pendingReviewChecks(task, candidate) ?? (await runChecks(task, signal));
  const unavailable = checks.find(({ status }) => status === null || status === 'not-applicable');
  if (unavailable)
    return {
      kind: 'blocked',
      reason: `Required check ${unavailable.id} is unavailable`,
      evidence: [unavailable.log],
    };
  const verdict = await assess(agent, session, plan, candidate, checks, signal);
  const failed = checks.filter((result) => result.status !== 0 || result.diagnostic);
  if (verdict.kind === 'accepted' && failed.length)
    return {
      kind: 'blocked',
      reason: 'Required candidate checks failed',
      evidence: failed.map(({ log }) => log),
    };
  return verdict;
}

type VerifiedCheck = Awaited<ReturnType<HostTask['check']>>;

/** Run the captured checklist once, retaining the exact failure or unavailable result. */
async function runChecks(task: HostTask, signal: AbortSignal) {
  const checks: VerifiedCheck[] = [];
  for (const id of task.capture.project.checks?.acceptance ?? []) {
    const result = await task.check(id, signal);
    checks.push(result);
    if (result.status === null || result.status === 'not-applicable') break;
  }
  return checks;
}

/** Resume research-assisted assessment on the same tree, checks and captured inputs. */
function pendingReviewChecks(task: HostTask, candidate: Candidate) {
  const events = task.observations<{
    verdict?: Verdict;
    researchingVerification?: {
      candidate: string;
      ownerEvidenceDigest?: string;
      revision: string;
      checks: VerifiedCheck[];
    };
  }>();
  const pending = events
    .slice(events.findLastIndex(({ verdict }) => !!verdict) + 1)
    .findLast(
      ({ researchingVerification }) => researchingVerification?.candidate === candidate.digest,
    )?.researchingVerification;
  if (
    pending?.revision === task.capture.source.revision &&
    pending.ownerEvidenceDigest === candidate.ownerEvidenceDigest &&
    pending.checks.every(({ log }) => task.evidence.includes(log))
  )
    return pending.checks;
}
