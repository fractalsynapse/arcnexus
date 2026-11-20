import { AgentActivityHold, InvalidAgentResponse, type Agent } from '../../agent/src/index.js';
import { resolve } from 'node:path';
import type { Plan } from '../../direction/src/index.js';
import { hostTask, retainedEvidence } from '../../execution/src/index.js';
import { validateVerdict, type Candidate, type Verdict } from '../../verification/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';

type CitedVerdict = Exclude<Verdict, { kind: 'blocked' }>;

/** Distinguish repairable Reviewer output from host or engineering failures. */
class ReviewerResponseError extends InvalidAgentResponse {}

/** Keep citation repair constrained to the first valid engineering determination. */
class ReviewerCitationError extends ReviewerResponseError {}

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
  const verdict = await reviewWithCitationRepair(task, agent, data, plan, candidate, signal);
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
    evidence: retainedEvidence(task, candidate.evidence),
  };
}

/** Repair distinct caller findings without repeating checks or changing a citation-only decision. */
async function reviewWithCitationRepair(
  task: ReturnType<typeof hostTask>,
  agent: Agent,
  data: ReturnType<typeof assessmentInput>,
  plan: Plan,
  candidate: Candidate,
  signal: AbortSignal,
) {
  const repair = new ReviewRepair(task, data, plan, candidate);
  while (true) {
    signal.throwIfAborted();
    try {
      const reply = await task.activate(agent, task.capture.project.verifier, repair.input, signal);
      return repair.validate(reply as Verdict);
    } catch (error) {
      signal.throwIfAborted();
      repair.retry(error);
    }
  }
}

/** Retain the original assessment and bounded citation decision across successive response repairs. */
class ReviewRepair {
  private readonly seen = new Set<string>();
  private verdict?: CitedVerdict;
  input: ReturnType<typeof assessmentInput>;

  /** Capture immutable engineering inputs and keep repair diagnostics local to this caller. */
  constructor(
    private readonly task: ReturnType<typeof hostTask>,
    private readonly original: ReturnType<typeof assessmentInput>,
    private readonly plan: Plan,
    private readonly candidate: Candidate,
  ) {
    this.input = original;
  }

  /** Validate response semantics before citations and preserve a pending citation-only decision. */
  validate(reply: Verdict) {
    const verdict = this.bind(reply);
    if (this.verdict && reviewPosition(verdict) !== reviewPosition(this.verdict))
      throw new ReviewerResponseError(
        'Reviewer citation repair changed the assessment decision, candidate or criteria',
      );
    try {
      return validateCitations(
        verdict,
        this.task.worktree ?? this.task.capture.source.root,
        this.task.evidence,
      );
    } catch (error) {
      if (error instanceof ReviewerCitationError) this.verdict ??= verdict;
      throw error;
    }
  }

  /** Classify malformed decisions and candidate bindings as response findings, retaining diagnostics. */
  private bind(reply: Verdict): CitedVerdict {
    try {
      if (!reply || !['accepted', 'rejected'].includes(reply.kind))
        throw new Error('The Reviewer returned an unsupported verdict');
      validateVerdict(this.plan, this.candidate, reply);
      return reply as CitedVerdict;
    } catch (error) {
      throw new ReviewerResponseError((error as Error).message, { cause: error });
    }
  }

  /** Return the exact new finding to this activity or retain an unchanged repeat as a hold. */
  retry(error: unknown) {
    if (!(error instanceof InvalidAgentResponse)) throw error;
    if (this.seen.has(error.identity))
      throw new AgentActivityHold(
        `Reviewer repeated an unchanged finding: ${error.message}`,
        this.task.evidence.slice(),
      );
    this.seen.add(error.identity);
    if (this.verdict) {
      this.input = citationRepairInput(this.task, this.original, this.verdict, error.message);
      return;
    }
    this.task.note({ reviewerResponseRepair: error.message });
    this.input = {
      ...this.original,
      assignment: { ...this.original.assignment, diagnostic: error.message },
    };
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
    evidence: retainedEvidence(task, data.evidence),
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
      'Read the candidate diff and trusted check evidence to assess the engineering criteria and engineering goal. The ownerChecks field contains exact host operations and statuses. An observation with a candidate tree and captured operation binds to that checkpoint. Compare its tree with the candidate being reviewed. Owner checks run in a networkless overlay. Observations before the last edit remain historical. The host observes GitHub checks, configured PR review, and the staging merge after independent acceptance. Treat those Release items as future delivery observations. Use ask-question if human clarification is required. Once the assessment is complete, return one JSON verdict without code fences. Evidence includes complete retained-task-evidence index files and current artifact paths. Read an index to discover the original references, read the relevant complete artifacts, and cite their exact retained paths.',
    candidate: candidate.digest,
    ownerEvidenceDigest: candidate.ownerEvidenceDigest,
    diagnostic: undefined as string | undefined,
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
    throw new ReviewerResponseError('The Reviewer returned an unsupported verdict');
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
