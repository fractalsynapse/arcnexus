import { hostTask } from '../../execution/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { TaskOutcome, TaskSession } from '../../workflow/src/index.js';

/** Integrate only the exact candidate accepted by Verification and the provider's gates. */
export async function integrate(
  session: TaskSession,
  candidate: Candidate,
  verdict: Extract<Verdict, { kind: 'accepted' }>,
  signal: AbortSignal,
): Promise<TaskOutcome> {
  signal.throwIfAborted();
  if (candidate.digest !== verdict.candidate)
    throw new Error('Delivery requires an accepting verdict for this candidate');
  const task = hostTask(session);
  const target = task.config.base;
  const provider = task.provider(signal);
  const { worktree, branch, issue, head } = task.commit(candidate);
  task.store(
    'publication.json',
    JSON.stringify({ target, branch, head, issue, candidate: candidate.digest }),
  );
  await provider.push(worktree, branch, head);
  const pr = await provider.pull(
    target,
    branch,
    `chore: ${task.goal.trim().split('\n')[0]!} (#${issue})`,
    `Part of #${issue}.\n\nVerified candidate: ${head}\n\n${task.goal}`,
  );
  task.store('pull-request.txt', pr);
  await provider.verify(pr, head, target);
  const commit = await provider.merge(pr, head, issue);
  task.store('staging-merge.json', JSON.stringify({ pr, head, commit, target }));
  return { kind: 'merged', commit, evidence: [pr, ...task.evidence] };
}
