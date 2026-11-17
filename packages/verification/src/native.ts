import type { Agent } from '../../agent/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask } from '../../execution/src/index.js';
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
  const ids = task.capture.project.checks?.acceptance ?? [];
  const checks = [];
  for (const id of ids) {
    const result = await task.check(id, signal);
    if (result.status === null || result.status === 'not-applicable')
      return {
        kind: 'blocked',
        reason: `Required check ${id} is unavailable`,
        evidence: [result.log],
      };
    checks.push(result);
  }
  const verdict = await assess(agent, session, plan, candidate, checks, signal);
  const failed = checks.filter((result) => result.status !== 0);
  if (verdict.kind === 'accepted' && failed.length)
    return {
      kind: 'blocked',
      reason: 'Required candidate checks failed',
      evidence: failed.map(({ log }) => log),
    };
  return verdict;
}
