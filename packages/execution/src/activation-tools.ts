import { createHash } from 'node:crypto';
import {
  canResearch,
  type ActivitySelection,
  type AgentInspection,
  type TaskContext,
} from '../../architecture/src/index.js';
import { archiveResearch } from './research-archive.js';
import { saveCheckpoint } from './checkpoint.js';
import { InvalidCodexResponse } from './codex.js';
import type { ActivityCheckpoint } from '../../workflow/src/index.js';
import { materializeEdits } from './formatter.js';
import type { HostTask } from './index.js';
import { inboxIdentity } from './research.js';
import { decodeEdit } from './steward-response.js';
import { listToolDirectory, readToolFile } from './tool-files.js';

type Tool = Pick<AgentInspection['request']['options']['tools'][number], 'name' | 'handler'>;
type Evidence = {
  editReceipt?: { id: string; path: string; before: string | null; after: string | null };
};

type Request = Record<string, unknown> & { kind: 'supplier' | 'research' | 'question' };
type RequestEvidence = {
  projectRequest?: Request & { scope: string };
  clarification?: { scope: string; question: string };
  researchRequest?: { inbox: string; question: string; decision: string };
  activation?: ActivityCheckpoint;
};

/** Dispatch captured project tools and keep final model output free of implicit actions. */
export class ActivationTools {
  private readonly checks = new Map<string, string>();
  private readonly scope: string;
  private handoff?: Request;

  /** Return whether a valid operation already requested a sequential handoff. */
  get requestedHandoff() {
    return this.handoff !== undefined;
  }

  /** Bind tool invocations to the current actor and durable activity position. */
  constructor(
    private readonly task: HostTask,
    private readonly selection: ActivitySelection,
    input: TaskContext,
    private readonly signal: AbortSignal,
  ) {
    this.scope = inboxIdentity(task, selection, input);
    this.handoff = this.pendingRequest(input.milestone);
  }

  /** Continue an acknowledged request if interruption occurred before its workflow recorded it. */
  private pendingRequest(milestone: unknown) {
    const events = this.task.observations<RequestEvidence>();
    const index = events.findLastIndex(
      ({ projectRequest }) => projectRequest?.scope === this.scope,
    );
    const request = events[index]?.projectRequest;
    if (!request) return;
    const handled = events
      .slice(index + 1)
      .some(({ clarification, researchRequest, activation }) => {
        if (request.kind === 'question')
          return clarification?.scope === this.scope && clarification.question === request.question;
        if (request.kind === 'research')
          return (
            researchRequest?.inbox === this.scope &&
            researchRequest.question === request.question &&
            researchRequest.decision === request.decision
          );
        const position = milestone as { id?: string } | undefined;
        return (
          !!activation &&
          activation.milestone === position?.id &&
          activation.step === this.selection.activity &&
          activation.outcome.kind === 'supplier'
        );
      });
    if (!handled) return request;
  }

  /** Dispatch only the handler selected by the already validated captured binding. */
  async invoke(tool: Tool, args: Record<string, unknown>): Promise<unknown> {
    this.signal.throwIfAborted();
    if (this.handoff) throw new Error('This activation has already requested a handoff');
    this.assertAuthority(tool);
    switch (tool.handler) {
      case 'read':
        return readToolFile(this.task, String(args.path), Number(args.offset ?? 0));
      case 'list':
        return listToolDirectory(this.task, String(args.path));
      case 'edit':
        return this.edit(tool, args);
      case 'archive':
        return this.archive(String(args.id));
      case 'check':
        this.checks.set(tool.name, String(args.expected));
        return {
          queued: tool.name,
          expected: args.expected,
          instructions:
            'The host runs queued checks after a completed response. Return completed when your requested work is ready for those checks.',
        };
      default:
        return this.request(tool.handler, args);
    }
  }

  /** Keep special actors and research read-only even if a capture is misconfigured. */
  private assertAuthority(tool: Tool) {
    if (!['edit', 'archive', 'check', 'supplier'].includes(tool.handler)) return;
    const { director, verifier } = this.task.capture.project;
    const { component, activity } = this.selection;
    const special = [director, verifier].some(
      (role) => role?.component === component && role.activity === activity,
    );
    if (special || activity === 'research')
      throw new Error(`Operation ${tool.name} is unavailable for ${component}/${activity}`);
  }

  /** Apply one proposed edit exactly once and checkpoint before returning its receipt. */
  private async edit(tool: Tool, args: Record<string, unknown>) {
    const proposal = decodeEdit(args);
    const id = createHash('sha256')
      .update(JSON.stringify([this.scope, tool.name, proposal]))
      .digest('hex');
    const prior = this.task
      .observations<Evidence>()
      .findLast(({ editReceipt }) => editReceipt?.id === id)?.editReceipt;
    if (prior) return prior;
    const [edit] = await materializeEdits(
      this.task,
      this.selection.component,
      [proposal],
      this.signal,
    );
    if (!edit) throw new Error('The checked edit produced no file proposal');
    return this.retainEdit(id, edit);
  }

  /** Route a reusable research report through the same one-file checked path. */
  private archive(report: string) {
    const [edit] = archiveResearch(this.task, this.selection.component, [report]);
    return edit ? this.retainEdit(report, edit) : { id: report, archived: true };
  }

  /** Save the accepted file and its receipt through the existing branch checkpoint. */
  private retainEdit(id: string, edit: Parameters<HostTask['edits']>[2][number]) {
    const { component, activity } = this.selection;
    const [observed] = this.task.edits(component, activity, [edit]);
    if (!observed) throw new Error('The checked edit produced no observation');
    const editReceipt = { id, ...observed };
    if (!saveCheckpoint(this.task, undefined, { editReceipt })) this.task.note({ editReceipt });
    return editReceipt;
  }

  /** Hand deferred requests back to the sequential workflow after this tool session ends. */
  private request(kind: 'supplier' | 'research' | 'question', args: Record<string, unknown>) {
    if (kind === 'research' && !canResearch(this.task.capture, this.selection.component))
      throw new Error(`No research activity is mapped for ${this.selection.component}`);
    for (const value of Object.values(args))
      if (typeof value !== 'string' || !value.trim())
        throw new Error(`Empty ${kind} request field`);
    this.handoff = { ...args, kind };
    this.task.note({ projectRequest: { scope: this.scope, ...this.handoff } });
    return {
      recorded: kind,
      instructions: 'Return an empty JSON object now so the host can fulfill the request.',
    };
  }

  /** Accept a structured outcome and attach only requests received over MCP. */
  finish(reply: unknown) {
    if (this.handoff) return this.handoff;
    if (!reply || typeof reply !== 'object' || !('kind' in reply)) return reply;
    if (['research', 'question', 'supplier'].includes(String(reply.kind)))
      throw new InvalidCodexResponse(`Use the mapped MCP tool for ${String(reply.kind)} requests`);
    if (reply.kind === 'blocked' && this.checks.size) {
      const operations = [...this.checks].map(([id, expected]) => `${id} (expected ${expected})`);
      throw new InvalidCodexResponse(
        `Queued checks ${operations.join(', ')} run after a completed response. Requeue the same checks via MCP; return completed if the only blocker was waiting for a check. Return blocked without queueing checks if a different prerequisite prevents progress.`,
      );
    }
    if (reply.kind !== 'completed') return reply;
    if (
      ['edits', 'checks', 'archiveResearch'].some((key) => {
        const value = (reply as Record<string, unknown>)[key];
        return value !== undefined && (!Array.isArray(value) || value.length > 0);
      })
    )
      throw new InvalidCodexResponse(
        'Use mapped MCP tools for edits, checks and research archival',
      );
    return {
      ...reply,
      edits: [],
      checks: [...this.checks].map(([id, expected]) => ({ id, expected })),
    };
  }
}
