import type { Agent } from '../../agent/src/index.js';
import { resolve } from 'node:path';
import type { Plan } from '../../direction/src/index.js';
import { hostTask } from '../../execution/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';

type CitedVerdict = Exclude<Verdict, { kind: 'blocked' }>;

/** Mark evidence validation failures eligible for one citation-only repair. */
class ReviewerCitationError extends Error {}

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
  const data = assessmentInput(task, plan, candidate, checks);
  const verdict = await reviewWithCitationRepair(task, agent, data, signal);
  const research = task.researchEvidence(selection, data);
  return research.length ? { ...verdict, research } : verdict;
}

/** Capture the candidate, engineering criteria, and host checks before invoking the Reviewer. */
function assessmentInput(
  task: ReturnType<typeof hostTask>,
  plan: Plan,
  candidate: Candidate,
  checks: unknown,
) {
  return {
    assignment: { ...responseShape(candidate, checks), ownerChecks: task.ownerReviewChecks() },
    milestone: plan.milestones,
    acceptance: plan.milestones.flatMap(({ owner, criteria }) =>
      criteria.map((criterion) => ({ owner, ...criterion })),
    ),
    evidence: [...new Set([...candidate.evidence, ...task.evidence])],
  };
}

/** Return the exact rejected citation once and revalidate against the same assessment. */
async function reviewWithCitationRepair(
  task: ReturnType<typeof hostTask>,
  agent: Agent,
  data: ReturnType<typeof assessmentInput>,
  signal: AbortSignal,
) {
  const selection = task.capture.project.verifier;
  const validate = (result: CitedVerdict) =>
    validateCitations(result, task.worktree ?? task.capture.source.root, task.evidence);
  const reply = (await task.activate(agent, selection, data, signal)) as CitedVerdict;
  try {
    return validate(reply);
  } catch (error) {
    if (!(error instanceof ReviewerCitationError)) throw error;
    signal.throwIfAborted();
    const repair = citationRepairInput(task, data, reply, error.message);
    const corrected = validate(
      (await task.activate(agent, selection, repair, signal)) as CitedVerdict,
    );
    if (reviewPosition(corrected) !== reviewPosition(reply))
      throw new Error(
        'Reviewer citation repair changed the assessment decision, candidate or criteria',
        { cause: error },
      );
    return corrected;
  }
}

/** Retain the failed observation and add its diagnostic to the existing assessment. */
function citationRepairInput(
  task: ReturnType<typeof hostTask>,
  data: ReturnType<typeof assessmentInput>,
  verdict: CitedVerdict,
  diagnostic: string,
) {
  task.note({ reviewerCitationRepair: { candidate: data.assignment.candidate, diagnostic } });
  const citationRepair = {
    diagnostic,
    verdict,
    instructions:
      'Correct only the evidence citations. Copy exact paths from the evidence list and preserve the decision, candidate, criteria and findings.',
  };
  return {
    ...data,
    assignment: { ...data.assignment, citationRepair },
    evidence: [...new Set([...data.evidence, ...task.evidence])],
  };
}

/** Compare the engineering determination independently of its citation fields. */
function reviewPosition(verdict: CitedVerdict) {
  const criteria =
    verdict.kind === 'accepted'
      ? [...verdict.criteria].sort()
      : verdict.findings.map(({ criterion, owner, reason }) => [criterion, owner, reason]);
  return JSON.stringify([verdict.kind, verdict.candidate, criteria]);
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
): CitedVerdict {
  if (!result || (result.kind !== 'accepted' && result.kind !== 'rejected'))
    throw new Error('The Reviewer returned an unsupported verdict');
  if (result.kind === 'accepted')
    return { ...result, evidence: citationPaths(result.evidence, 'evidence', worktree, evidence) };
  return {
    ...result,
    findings: result.findings.map((finding, index) => ({
      ...finding,
      evidence: citationPaths(finding.evidence, `findings[${index}].evidence`, worktree, evidence),
    })),
  };
}

/** Identify exactly which submitted citation failed the existing evidence gate. */
function citationPaths(
  paths: unknown,
  field: string,
  worktree: string,
  evidence: readonly string[],
) {
  if (!Array.isArray(paths) || !paths.length)
    throw new ReviewerCitationError(
      `${field}: expected a nonempty list of retained evidence paths, received ${JSON.stringify(paths)}`,
    );
  return paths.map((path: unknown, index) => {
    if (typeof path !== 'string')
      throw new ReviewerCitationError(
        `${field}[${index}]: expected a retained evidence path, received ${JSON.stringify(path)}`,
      );
    const resolved = resolve(worktree, path);
    if (!evidence.includes(resolved))
      throw new ReviewerCitationError(
        `${field}[${index}]: ${JSON.stringify(path)} resolves to ${JSON.stringify(resolved)}, which is outside the retained evidence list`,
      );
    return resolved;
  });
}
