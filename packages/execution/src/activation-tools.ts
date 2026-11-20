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
import { selfLinkedSupplier, type ActivityCheckpoint } from '../../workflow/src/index.js';
import { materializeEdits } from './formatter.js';
import type { HostTask } from './index.js';
import { inboxIdentity, researchFields } from './research.js';
import { decodeEdit } from './steward-response.js';
import { listToolDirectory, readToolFile } from './tool-files.js';
import { repairCheckExpectation, type StewardScope } from './steward-check.js';

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
  projectReply?: { scope: string };
};

/** Dispatch captured project tools and keep final model output free of implicit actions. */
export class ActivationTools {
  private readonly scope: string;
  private readonly milestone?: string;
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
    this.milestone = (input.milestone as { id?: string } | undefined)?.id;
    this.handoff = this.pendingRequest();
  }

  /** Continue an acknowledged request if interruption occurred before its workflow recorded it. */
  private pendingRequest() {
    const events = this.task.observations<RequestEvidence>();
    const index = events.findLastIndex(
      ({ projectRequest }) => projectRequest?.scope === this.scope,
    );
    const request = events[index]?.projectRequest;
    if (!request || selfLinkedSupplier(request, this.milestone)) return;
    const handled = events
      .slice(index + 1)
      .some(({ clarification, researchRequest, activation, projectReply }) => {
        if (projectReply?.scope === this.scope) return true;
        if (request.kind === 'question')
          return clarification?.scope === this.scope && clarification.question === request.question;
        if (request.kind === 'research')
          return (
            researchRequest?.inbox === this.scope &&
            researchRequest.question === request.question &&
            researchRequest.decision === request.decision
          );
        return (
          !!activation &&
          activation.milestone === this.milestone &&
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
        return this.check(tool.name, args.expected as 'pass' | 'fail');
      default:
        return this.request(tool.handler, args);
    }
  }

  /** Preserve unresolved expectations before executing another request for the same operation. */
  private check(id: string, expected: 'pass' | 'fail') {
    const activity =
      this.task.capture.components[this.selection.component]?.activities[this.selection.activity];
    if (expected !== 'pass' && activity?.verification?.includes(id))
      throw new Error(`Operation ${id} requires pass for declared activity verification`);
    const scope: StewardScope = {
      owner: this.selection.component,
      activity: this.selection.activity as StewardScope['activity'],
      expected,
    };
    repairCheckExpectation(this.task, id, scope);
    return this.task.check(id, this.signal, scope);
  }

  /** Keep special actors and research read-only even if a capture is misconfigured. */
  private assertAuthority(tool: Tool) {
    if (this.task.inbox && ['edit', 'archive'].includes(tool.handler))
      throw new Error(
        'An inbox contribution is read-only; request explicit implementation through escalation',
      );
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
    const root = this.task.capture.project.knowledgeRoot ?? '.arc';
    if (
      [`${root}/goals/`, `${root}/objectives/`].some((prefix) => proposal.path.startsWith(prefix))
    )
      throw new Error('Objectives and goals require the exact Planner approval route');
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
    const request = { ...args, ...(kind === 'research' ? researchFields(args) : {}), kind };
    if (selfLinkedSupplier(request, this.milestone))
      throw new Error(
        `Supplier milestone ${this.milestone} is your current milestone. Continue this activity or link a distinct contribution.`,
      );
    this.handoff = request;
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
    if (reply.kind !== 'completed') return reply;
    if (this.hasDirectOperations(reply as Record<string, unknown>))
      throw new InvalidCodexResponse(
        'Use mapped MCP tools for edits, checks and research archival',
      );
    return {
      ...reply,
      edits: [],
      checks: [],
    };
  }

  /** Refuse requested effects in model output; successful tool calls are already recorded. */
  private hasDirectOperations(reply: Record<string, unknown>) {
    return ['edits', 'checks', 'archiveResearch'].some((key) => {
      const value = reply[key];
      return value !== undefined && (!Array.isArray(value) || value.length > 0);
    });
  }
}
