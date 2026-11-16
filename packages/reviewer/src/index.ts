import type { Agent } from '../../agent/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask } from '../../execution/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';

/** Activate the captured read-only Reviewer against the assembled evidence. */
export async function assess(
  agent: Agent,
  session: TaskSession,
  plan: Plan,
  candidate: Candidate,
  checks: unknown,
  signal: AbortSignal,
): Promise<Verdict> {
  const task = hostTask(session);
  const result = (await task.activate(
    agent,
    task.capture.project.verifier,
    {
      assignment: responseShape(candidate, checks),
      milestone: plan.milestones,
      acceptance: plan.milestones.flatMap(({ owner, criteria }) =>
        criteria.map((criterion) => ({ owner, ...criterion })),
      ),
      evidence: [...new Set([...candidate.evidence, ...task.evidence])],
    },
    signal,
  )) as Verdict;
  return validated(result, task.evidence);
}

/** Describe the candidate-bound verdict and its required evidence. */
function responseShape(candidate: Candidate, checks: unknown) {
  return {
    instructions:
      'Read the candidate diff and trusted check evidence before assessing the original goal. Return one JSON object, with no code fences. Cite existing evidence file paths.',
    candidate: candidate.digest,
    checks,
    accepted: {
      kind: 'accepted',
      candidate: candidate.digest,
      criteria: ['all accepted criterion IDs'],
      evidence: ['evidence paths'],
    },
    rejected: {
      kind: 'rejected',
      candidate: candidate.digest,
      findings: [
        {
          criterion: 'criterion ID',
          owner: 'component ID',
          reason: 'observed deficiency',
          evidence: ['evidence paths'],
        },
      ],
    },
  };
}

/** Require a verdict whose citations refer to retained task evidence. */
function validated(result: Verdict, evidence: readonly string[]) {
  if (!result || (result.kind !== 'accepted' && result.kind !== 'rejected'))
    throw new Error('The Reviewer returned an unsupported verdict');
  const citations =
    result.kind === 'accepted'
      ? result.evidence
      : result.findings.flatMap(({ evidence }) => evidence);
  if (
    !Array.isArray(citations) ||
    !citations.length ||
    citations.some((path) => !evidence.includes(path))
  )
    throw new Error('Reviewer verdict must cite retained evidence');
  return result;
}
