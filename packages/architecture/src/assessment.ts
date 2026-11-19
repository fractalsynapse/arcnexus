import { AgentActivityHold, InvalidAgentResponse, type Agent } from '../../agent/src/index.js';
import type { HostTask } from '../../execution/src/index.js';
import type { TaskContext } from './request.js';
import { revisionCitation } from './revision-citation.js';
import { architectureGate, architectureQuestion, type ArchitectureRecord } from './approval.js';
import { prepareArchitectureProposal } from './decode-proposal.js';
import { ArchitectureResponseError, type ArchitectureDecision } from './proposal.js';
import { architectAssignment } from './assignment.js';

/** Assess real captured source and keep proposals and human decisions in the existing task journal. */
export class ArchitectureAssessment {
  private readonly selection;

  /** Bind the explicit Architect activity, its real host session and the current feedback. */
  constructor(
    private readonly agent: Agent,
    private readonly task: HostTask,
    private readonly feedback: string | undefined,
    private readonly signal: AbortSignal,
  ) {
    const selection = task.capture.project.architect;
    if (!selection)
      throw new Error('Architecture updates require an explicit project architect binding');
    this.selection = selection;
  }

  /** Resume the exact pending batch or assess fresh inputs before asking the durable human gate. */
  async propose(): Promise<ArchitectureDecision> {
    const prior = this.task
      .observations<{ architectureProposal?: ArchitectureRecord }>()
      .findLast(
        ({ architectureProposal }) =>
          architectureProposal?.proposal.baseline === this.task.capture.source.revision &&
          architectureProposal.proposal.feedback === this.feedback,
      )?.architectureProposal;
    const result = prior ?? (await this.generate());
    if ('kind' in result) return result;
    return this.decide(result);
  }

  /** Record the exact human decision and retain the batch unchanged when it is declined. */
  private async decide(result: ArchitectureRecord): Promise<ArchitectureDecision> {
    const question = architectureQuestion(result.proposal);
    const receipt = await this.task.requestDecision(
      this.selection,
      architectureGate(result.proposal),
      question,
      this.signal,
    );
    const approved = receipt.answer.trim().toLowerCase() === 'approve';
    this.task.note({
      architectureDecision: {
        id: result.proposal.id,
        baseline: result.proposal.baseline,
        decision: approved ? 'approved' : 'declined',
        receipt: receipt.evidence,
      },
    });
    return approved
      ? { kind: 'approved', ...result }
      : {
          kind: 'no-change',
          summary: 'The architecture proposal was declined; accepted authority is unchanged.',
          evidence: [result.report, receipt.evidence],
        };
  }

  /** Return malformed output to its caller, retaining distinct diagnoses and stopping unchanged repeats. */
  private async generate(): Promise<
    ArchitectureRecord | Exclude<ArchitectureDecision, { kind: 'approved' }>
  > {
    if (!this.task.worktree) this.task.planningWorkspace(this.signal);
    const findings = this.task.store(
      'architecture-findings.json',
      JSON.stringify(this.task.journal.findings(), null, 2),
    );
    const seen = new Set<string>();
    let diagnostic: string | undefined;
    while (true) {
      this.signal.throwIfAborted();
      const data = architectAssignment(this.task, this.feedback, findings, diagnostic);
      try {
        const reply = await this.task.activate(this.agent, this.selection, data, this.signal);
        return this.decode(reply, data);
      } catch (error) {
        this.signal.throwIfAborted();
        if (!(error instanceof InvalidAgentResponse)) throw error;
        if (seen.has(error.message))
          throw new AgentActivityHold(
            `Architect repeated an unchanged finding: ${error.message}`,
            this.task.evidence.slice(-4),
          );
        seen.add(error.message);
        diagnostic = error.message;
        this.task.note({ architectureResponseRepair: diagnostic });
      }
    }
  }

  /** Decode the actor response without applying any proposed source change or trusting its approval data. */
  private decode(reply: unknown, data: Omit<TaskContext, 'goal' | 'worktree'>) {
    if (!reply || typeof reply !== 'object')
      throw new ArchitectureResponseError('Architect response must be an object');
    const value = reply as Record<string, unknown>;
    if (value.kind === 'no-change') return this.noChange(value);
    if (value.kind === 'supplier') return this.supplier(value, data);
    if (value.kind !== 'proposal')
      throw new ArchitectureResponseError(
        'Return a justified no-change assessment or an exact proposal; approval belongs to the host human gate',
      );
    const proposal = prepareArchitectureProposal(this.task.capture, value, this.feedback);
    const report = this.task.store('architecture-proposal.md', architectureQuestion(proposal));
    const record = { proposal, report };
    this.task.note({ architectureProposal: record });
    return record;
  }

  /** Require revision-linked source evidence rather than accepting an unsupported no-change claim. */
  private noChange(value: Record<string, unknown>) {
    const evidence = assessmentEvidence(this.task, value);
    const report = this.task.store(
      'architecture-assessment.md',
      `${value.summary}\n\n${evidence.join('\n')}\n`,
    );
    const assessment = {
      kind: 'no-change' as const,
      summary: value.summary as string,
      evidence: [report, ...evidence],
    };
    this.task.note({
      architectureAssessment: assessment,
      baseline: this.task.capture.source.revision,
    });
    return assessment;
  }

  /** Accept only a complete explicit supplier request from the actual caller inbox. */
  private supplier(value: Record<string, unknown>, data: Omit<TaskContext, 'goal' | 'worktree'>) {
    for (const field of ['milestone', 'owner', 'reason', 'question'] as const)
      if (typeof value[field] !== 'string' || !value[field].trim())
        throw new ArchitectureResponseError(`Architect supplier requires ${field}`);
    if (!this.task.capture.components[String(value.owner)])
      throw new ArchitectureResponseError(`Unknown supplier owner: ${String(value.owner)}`);
    const scope = this.task.inboxScope(this.selection, data);
    const answered = this.task
      .observations<{ projectReply?: { scope: string; owner: string; question: string } }>()
      .some(
        ({ projectReply }) =>
          projectReply?.scope === scope &&
          projectReply.owner === value.owner &&
          projectReply.question === value.question,
      );
    if (answered)
      throw new ArchitectureResponseError(
        'This supplier question is already answered completely in assignment.answers',
      );
    return {
      kind: 'supplier' as const,
      milestone: value.milestone as string,
      owner: value.owner as string,
      reason: value.reason as string,
      question: value.question as string,
      scope,
      evidence: [],
    };
  }
}

/** Validate meaningful no-change claims against exact captured source citations. */
function assessmentEvidence(task: HostTask, value: Record<string, unknown>) {
  if (
    typeof value.summary !== 'string' ||
    !value.summary.trim() ||
    !Array.isArray(value.evidence) ||
    !value.evidence.length
  )
    throw new ArchitectureResponseError(
      'A no-change assessment requires a summary and source citations',
    );
  const evidence = value.evidence.map((entry) => {
    try {
      const citation = revisionCitation(entry, task.capture.source);
      return `${task.capture.source.revision}:${citation.path} · ${citation.quote}`;
    } catch (error) {
      throw new ArchitectureResponseError((error as Error).message);
    }
  });
  return evidence;
}
