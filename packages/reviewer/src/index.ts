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
  const selection = task.capture.project.verifier;
  const data = {
    assignment: { ...responseShape(candidate, checks), ownerChecks: task.ownerReviewChecks() },
    milestone: plan.milestones,
    acceptance: plan.milestones.flatMap(({ owner, criteria }) =>
      criteria.map((criterion) => ({ owner, ...criterion })),
    ),
    evidence: [...new Set([...candidate.evidence, ...task.evidence])],
  };
  const result = (await task.activate(agent, selection, data, signal)) as Verdict;
  const verdict = validateCitations(
    result,
    task.worktree ?? task.capture.source.root,
    task.evidence,
  );
  const research = task.researchEvidence(selection, data);
  return research.length && verdict.kind !== 'blocked' ? { ...verdict, research } : verdict;
}

/** Describe the candidate-bound verdict and its required evidence. */
function responseShape(candidate: Candidate, checks: unknown) {
  return {
    instructions:
      'Read the candidate diff and trusted check evidence to assess the engineering criteria and engineering goal. The ownerChecks field contains exact host operations and statuses. An observation with a candidate tree and captured operation binds to that checkpoint. Compare its tree with the candidate being reviewed. Owner checks run in a networkless overlay. Observations before the last edit remain historical. The host observes GitHub checks, configured PR review, and the staging merge after independent acceptance. Treat those Release items as future delivery observations. Use ask-question if human clarification is required. Once the assessment is complete, return one JSON verdict without code fences. Cite paths from the evidence list.',
    candidate: candidate.digest,
    ownerEvidenceDigest: candidate.ownerEvidenceDigest,
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
