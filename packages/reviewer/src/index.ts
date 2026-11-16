import type { Agent } from '../../agent/src/index.js';
import { resolve } from 'node:path';
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
  return validateCitations(result, task.worktree ?? task.capture.source.root, task.evidence);
}

/** Describe the candidate-bound verdict and its required evidence. */
function responseShape(candidate: Candidate, checks: unknown) {
  return {
    instructions:
      'Read the candidate diff and trusted check evidence before assessing the original goal. Return one JSON object, with no code fences. Cite paths from the evidence list.',
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
export function validateCitations(
  result: Verdict,
  worktree: string,
  evidence: readonly string[],
): Verdict {
  if (!result || (result.kind !== 'accepted' && result.kind !== 'rejected'))
    throw new Error('The Reviewer returned an unsupported verdict');
  const refs = (paths: readonly string[]) => {
    if (!Array.isArray(paths) || !paths.length || paths.some((path) => typeof path !== 'string'))
      throw new Error('Reviewer verdict must cite retained evidence');
    const references = paths.map((path) => resolve(worktree, path));
    if (references.some((path) => !evidence.includes(path)))
      throw new Error('Reviewer verdict must cite retained evidence');
    return references;
  };
  if (result.kind === 'accepted') return { ...result, evidence: refs(result.evidence) };
  return {
    ...result,
    findings: result.findings.map((finding) => ({ ...finding, evidence: refs(finding.evidence) })),
  };
}
