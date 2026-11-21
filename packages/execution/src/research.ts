import { InvalidAgentResponse } from '../../agent/src/index.js';
import { createHash } from 'node:crypto';
import { stringify } from 'yaml';
import {
  canResearch,
  researchDirectory,
  type ActivitySelection,
  type TaskContext,
} from '../../architecture/src/index.js';
import type { HostTask } from './index.js';
import { InvalidCodexResponse } from './codex.js';

type InboxTask = Pick<HostTask, 'capture' | 'taskID' | 'note' | 'observations' | 'store'> &
  Partial<Pick<HostTask, 'config'>>;
type Assignment = Omit<TaskContext, 'goal' | 'worktree'>;
type Invoke = (selection: ActivitySelection, assignment: Assignment) => Promise<unknown>;

interface Request {
  id: string;
  inbox: string;
  requestedBy: ActivitySelection;
  question: string;
  decision: string;
}

export interface ResearchResult {
  request: Request;
  component: string;
  evidence: string;
  archive?: string;
  summary?: string;
  digest?: string;
  unavailable?: true;
}

interface Observation {
  researchRequest?: Request;
  researchResult?: ResearchResult;
}

/** Use one task journal to pause, research, and resume any requesting actor. */
export class ResearchInbox {
  /** Bind the inbox to the captured task and its existing sequential invoker. */
  constructor(
    private readonly task: InboxTask,
    private readonly invoke: Invoke,
    private readonly signal: AbortSignal,
  ) {}

  /** Dispatch research only for a recorded request and resume the original activation. */
  async run(selection: ActivitySelection, data: Assignment) {
    const { capture } = this.task;
    if (selection.activity === 'research' || !canResearch(capture, selection.component))
      return this.invoke(selection, data);
    const inbox = inboxIdentity(this.task, selection, data, callerRevision(this.task, selection));
    const requests = this.task
      .observations<Observation>()
      .flatMap(({ researchRequest }) =>
        researchRequest?.inbox === inbox ? [researchRequest] : [],
      );
    while (true) {
      this.signal.throwIfAborted();
      const results = await this.results(selection.component, requests, data);
      const reply = await this.invoke(selection, withResults(data, results));
      const request = researchRequest(reply, inbox, selection);
      if (!request) return reply;
      if (requests.some(({ id }) => id === request.id))
        throw new InvalidCodexResponse(`Research question already answered: ${request.question}`);
      this.task.note({
        researchRequest: request,
        ...verificationContext(this.task, selection, data),
      });
      requests.push(request);
    }
  }

  /** Load a completed result or finish the last pending request after interruption. */
  private async results(component: string, requests: readonly Request[], data: Assignment) {
    const observed = this.task.observations<Observation>();
    const results: ResearchResult[] = [];
    for (const request of requests) {
      this.signal.throwIfAborted();
      const stored = observed.findLast(
        ({ researchResult }) => researchResult?.request.id === request.id,
      )?.researchResult;
      results.push(stored ?? (await this.research(component, request, data)));
    }
    return results;
  }

  /** Return a research report or a retained unavailable observation to the requester. */
  private async research(component: string, request: Request, data: Assignment) {
    let report: ReturnType<typeof decodeReport>;
    try {
      report = await this.generateReport(component, request, data);
    } catch (error) {
      this.signal.throwIfAborted();
      return this.unavailable(component, request, error);
    }
    return this.retain(component, request, report);
  }

  /** Return exact report findings to Research while preserving its original read-only question. */
  private async generateReport(component: string, request: Request, data: Assignment) {
    const seen = new Set<string>();
    let diagnostic: string | undefined;
    while (true) {
      this.signal.throwIfAborted();
      try {
        const response = await this.invoke(
          { component, activity: 'research' },
          researchInput(request, data, diagnostic),
        );
        this.signal.throwIfAborted();
        return decodeReport(response);
      } catch (error) {
        this.signal.throwIfAborted();
        if (!(error instanceof InvalidAgentResponse)) throw error;
        if (seen.has(error.identity))
          throw new Error(`Research repeated an unchanged finding: ${error.message}`, {
            cause: error,
          });
        seen.add(error.identity);
        diagnostic = error.message;
        this.task.note({ researchResponseRepair: { request: request.id, diagnostic } });
      }
    }
  }

  /** Keep an unavailable result readable without terminating the requesting task. */
  private unavailable(component: string, request: Request, error: unknown): ResearchResult {
    const diagnostic = error instanceof Error ? error.message : String(error);
    const evidence = this.task.store(
      'research-unavailable.md',
      `# Research unavailable

${diagnostic}
`,
    );
    const result = { request, component, evidence, unavailable: true } as const;
    this.task.note({ researchResult: result });
    return result;
  }

  /** Persist the report before any requester can advance past it. */
  private retain(component: string, request: Request, report: ReturnType<typeof decodeReport>) {
    const markdown = renderReport(report, request, this.task.capture.source.revision);
    const evidence = this.task.store('research.md', markdown);
    const archive = `${researchDirectory(this.task.capture, component)}/${request.id}.md`;
    const result: ResearchResult = {
      request,
      component,
      evidence,
      ...(report.reusable
        ? {
            archive,
            summary: report.summary,
            digest: createHash('sha256').update(markdown).digest('hex'),
          }
        : {}),
    };
    this.task.note({ researchResult: result });
    return result;
  }
}

/** Preserve the full research direction and return malformed-response diagnostics to its caller. */
function researchInput(request: Request, data: Assignment, diagnostic?: string): Assignment {
  return {
    ...data,
    assignment: {
      question: request.question,
      decision: request.decision,
      requestedBy: request.requestedBy,
      candidate: object(data.assignment)?.candidate,
      diagnostic,
      instructions:
        'Return exactly one JSON object matching the research report schema. Start with { and end with }. Use no Markdown headings, code fences, or explanation outside the object. Provide the detail needed to answer the complete research direction and cite sources you actually consulted. Preserve complete findings, applicability, sources and unresolved questions. Repair malformed responses while retaining the original question and decision.',
    },
  };
}

/** List the exact reports attached to this candidate's assessment. */
export function usedResearch(task: InboxTask, selection: ActivitySelection, data: Assignment) {
  const id = inboxIdentity(task, selection, data, callerRevision(task, selection));
  return task
    .observations<Observation>()
    .flatMap(({ researchResult }) =>
      researchResult?.request.inbox === id ? [researchResult.evidence] : [],
    );
}

/** Pin existing verification inputs before a Reviewer research handoff can be interrupted. */
export function verificationContext(
  task: InboxTask,
  selection: ActivitySelection,
  data: Assignment,
) {
  const verifier = task.capture.project.verifier;
  const assignment = object(data.assignment);
  if (
    !verifier ||
    selection.component !== verifier.component ||
    selection.activity !== verifier.activity ||
    !assignment ||
    !Array.isArray(assignment.checks)
  )
    return {};
  return {
    researchingVerification: {
      candidate: assignment.candidate,
      ownerEvidenceDigest: assignment.ownerEvidenceDigest,
      revision: task.capture.source.revision,
      checks: assignment.checks,
    },
  };
}

/** Keep ordinary caller continuity on its original base while independent review uses the current capture. */
export function callerRevision(task: InboxTask, selection: ActivitySelection) {
  const verifier = task.capture.project.verifier;
  if (selection.component === verifier?.component && selection.activity === verifier.activity)
    return;
  return task.observations<{ baseRevision?: string }>().find(({ baseRevision }) => baseRevision)
    ?.baseRevision;
}

/** Preserve caller answers across approved in-run adoption; exact host gates also bind their proposal baseline. */
export function inboxIdentity(
  task: InboxTask,
  selection: ActivitySelection,
  data: Assignment,
  revision = task.config?.capture.source.revision ?? task.capture.source.revision,
) {
  const intent =
    selection.component === 'planner' &&
    selection.activity === 'planning' &&
    object(data.assignment)?.mode === 'human objective';
  return identity([
    task.taskID,
    intent ? 'human objective' : revision,
    selection.component,
    selection.activity,
    data.milestone,
    data.acceptance,
    object(data.assignment)?.candidate,
    object(data.assignment)?.ownerEvidenceDigest,
  ]);
}

/** Interpret only the explicit request outcome and derive its stable journal identity. */
function researchRequest(
  value: unknown,
  inbox: string,
  requestedBy: ActivitySelection,
): Request | undefined {
  const reply = object(value);
  if (reply?.kind !== 'research') return;
  const { question, decision } = researchFields(reply);
  return { id: identity([inbox, question, decision]), inbox, requestedBy, question, decision };
}

/** Validate required research fields without restricting the amount of useful direction. */
export function researchFields(value: Record<string, unknown>) {
  return {
    question: required(value.question, 'question'),
    decision: required(value.decision, 'decision'),
  };
}

/** Preserve the requesting assignment and attach the recorded research evidence by reference. */
function withResults(data: Assignment, results: readonly ResearchResult[]): Assignment {
  if (!results.length) return data;
  return {
    ...data,
    assignment: {
      ...(object(data.assignment) ?? { original: data.assignment }),
      researchContinuation:
        'The host has resolved these requests. Read the reports and continue the original activity. An unavailable result is final for that question. Only request research again for a different question that can change a decision.',
      researchResults: results.map(({ request, evidence, archive, unavailable }) => ({
        id: request.id,
        question: request.question,
        evidence,
        archive,
        unavailable,
      })),
    },
    evidence: [...new Set([...(data.evidence ?? []), ...results.map(({ evidence }) => evidence)])],
  };
}

/** Validate the researcher's structured synthesis before writing a report. */
function decodeReport(value: unknown) {
  try {
    const reply = object(value);
    if (reply?.kind !== 'research-report') throw new Error('Expected a research-report response');
    if (!Array.isArray(reply.sources)) throw new Error('Research sources must be an array');
    if (!Array.isArray(reply.unresolved))
      throw new Error('Research unresolved points must be an array');
    if (typeof reply.reusable !== 'boolean') throw new Error('Research reusable must be boolean');
    return {
      summary: required(reply.summary, 'summary'),
      findings: required(reply.findings, 'findings'),
      sources: reply.sources.map(source),
      applicability: required(reply.applicability, 'applicability'),
      unresolved: reply.unresolved.map((item) => required(item, 'unresolved')),
      reusable: reply.reusable,
    };
  } catch (error) {
    throw new InvalidAgentResponse((error as Error).message, { cause: error });
  }
}

/** Preserve public source URLs and their role in the synthesis. */
function source(value: unknown) {
  const entry = object(value);
  const url = new URL(required(entry?.url, 'source URL'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Research source must be a public HTTP or HTTPS URL');
  return { url: url.href, note: required(entry?.note, 'source note') };
}

/** Render a readable report whose frontmatter supplies its index entry. */
function renderReport(report: ReturnType<typeof decodeReport>, request: Request, revision: string) {
  const metadata = stringify({
    question: request.question,
    summary: report.summary,
    consulted: new Date().toISOString().slice(0, 10),
    requestedBy: request.requestedBy,
    revision,
  });
  const sections = {
    Decision: request.decision,
    Findings: report.findings,
    Applicability: report.applicability,
    Sources: report.sources.map(({ url, note }) => `- <${url}> — ${note}`).join('\n'),
    Unresolved: report.unresolved.map((item) => `- ${item}`).join('\n') || 'None recorded.',
  };
  return [
    '---',
    metadata.trimEnd(),
    '---',
    '',
    '# Research report',
    '',
    ...Object.entries(sections).flatMap(([name, text]) => [`## ${name}`, '', text, '']),
  ].join('\n');
}

/** Preserve structured fields without coercing arbitrary model output. */
function object(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
}

/** Require meaningful text while preserving complete requests and research findings. */
function required(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Invalid research ${field}: expected nonempty text`);
  return value;
}

/** Bind report identity to its task activation and normalized request. */
function identity(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
