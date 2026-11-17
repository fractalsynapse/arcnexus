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

type InboxTask = Pick<HostTask, 'capture' | 'taskID' | 'note' | 'observations' | 'store'>;
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
    const inbox = inboxIdentity(this.task, selection, data);
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
      const response = await this.invoke(
        { component, activity: 'research' },
        {
          ...data,
          assignment: {
            question: request.question,
            decision: request.decision,
            requestedBy: request.requestedBy,
            candidate: object(data.assignment)?.candidate,
            instructions:
              'Return exactly one JSON object matching the research report schema. Start with { and end with }. Use no Markdown headings, code fences, or explanation outside the object. Cite sources you actually consulted.',
          },
        },
      );
      this.signal.throwIfAborted();
      report = decodeReport(response);
    } catch (error) {
      this.signal.throwIfAborted();
      return this.unavailable(component, request, error);
    }
    return this.retain(component, request, report);
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

/** List the exact reports attached to this candidate's assessment. */
export function usedResearch(task: InboxTask, selection: ActivitySelection, data: Assignment) {
  const id = inboxIdentity(task, selection, data);
  return task
    .observations<Observation>()
    .flatMap(({ researchResult }) =>
      researchResult?.request.inbox === id ? [researchResult.evidence] : [],
    );
}

/** Pin existing verification inputs before a Reviewer research handoff can be interrupted. */
function verificationContext(task: InboxTask, selection: ActivitySelection, data: Assignment) {
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

/** Preserve a request's identity for the same captured activation after retry. */
function inboxIdentity(task: InboxTask, selection: ActivitySelection, data: Assignment) {
  return identity([
    task.taskID,
    task.capture.source.revision,
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
  const question = required(reply.question, 'question', 500);
  const decision = required(reply.decision, 'decision', 500);
  return { id: identity([inbox, question, decision]), inbox, requestedBy, question, decision };
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
  const reply = object(value);
  if (reply?.kind !== 'research-report') throw new Error('Expected a research-report response');
  if (!Array.isArray(reply.sources) || !reply.sources.length || reply.sources.length > 12)
    throw new Error('Research needs between one and twelve source references');
  if (!Array.isArray(reply.unresolved) || reply.unresolved.length > 12)
    throw new Error('Research unresolved points must be a short array');
  if (typeof reply.reusable !== 'boolean') throw new Error('Research reusable must be boolean');
  return {
    summary: required(reply.summary, 'summary', 600),
    findings: required(reply.findings, 'findings', 8000),
    sources: reply.sources.map(source),
    applicability: required(reply.applicability, 'applicability', 1000),
    unresolved: reply.unresolved.map((item) => required(item, 'unresolved', 500)),
    reusable: reply.reusable,
  };
}

/** Preserve public source URLs and their role in the synthesis. */
function source(value: unknown) {
  const entry = object(value);
  const url = new URL(required(entry?.url, 'source URL', 2048));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Research source must be a public HTTP or HTTPS URL');
  return { url: url.href, note: required(entry?.note, 'source note', 500) };
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

/** Require a bounded nonempty field in a request or report. */
function required(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`Invalid research ${field}`);
  return value.trim();
}

/** Bind report identity to its task activation and normalized request. */
function identity(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
