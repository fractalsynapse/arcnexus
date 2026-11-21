import type { Agent } from '../../agent/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask, type HostTask } from '../../execution/src/index.js';
import { assess } from '../../reviewer/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Candidate, Verdict } from './index.js';
import { verificationIdentity } from './identity.js';

/** Run the captured acceptance checklist before an independent review. */
export async function verify(
  agent: Agent,
  session: TaskSession,
  plan: Plan,
  candidate: Candidate,
  signal: AbortSignal,
): Promise<Verdict> {
  const task = hostTask(session);
  const checks = await runChecks(task, signal);
  const assessed = {
    ...candidate,
    verification: verificationIdentity(session, plan, candidate, checks),
  };
  task.note({ verification: { identity: assessed.verification, checks } });
  const failure = requiredCheckFailure(checks);
  if (failure) return failure;
  return assess(agent, session, plan, assessed, checks, signal);
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

/** Keep unavailable, skipped, failed and invalid-scope evidence from authorizing acceptance. */
function requiredCheckFailure(checks: readonly VerifiedCheck[]): Verdict | undefined {
  const unavailable = checks.find(({ status }) => status === null || status === 'not-applicable');
  if (unavailable)
    return {
      kind: 'blocked',
      reason: `Required check ${unavailable.id} is unavailable`,
      evidence: [unavailable.log],
    };
  const failed = checks.filter((result) => result.status !== 0 || result.diagnostic);
  if (failed.length)
    return {
      kind: 'blocked',
      reason: 'Required candidate checks failed',
      evidence: failed.map(({ log }) => log),
    };
}
