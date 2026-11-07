import { requestProposal, type ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { assignmentIntent } from './assignment-intent.js';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';
import type { StewardSession } from '../assignment/steward.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { ProgressObserver } from '../report/progress.js';
import type { AgentResult } from '../steward/codex.js';
import { save, type RecordData } from '../workspace/state.js';

/** Rejects invalid dependency intent before recipients exist and retains correction evidence. */
export class RequestAdmission {
  /** Uses captured package authority and the requester's existing private evidence directory. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {}

  /** Validates the complete batch before routing any request or accompanying inbox action. */
  accept(
    record: RecordData,
    sender: ExecutionAssignment,
    requests: AgentResult['requests'],
  ): boolean {
    const errors = requests.flatMap((request, index) => this.validate(sender, request, index));
    if (!errors.length) return true;
    const warning = new ProgressObserver(this.root, record).failed(
      { activity: 'request-admission' },
      JSON.stringify(errors),
      candidateDigest(record),
    );
    record.requestCorrection = {
      errors,
      requests,
      actions: record.pendingInboxActions ?? [],
      warning,
    };
    delete record.pendingRequests;
    save(this.root, record);
    return false;
  }

  /** Runs one coordination activation without changing the accepted engineering stage, plan or permissions. */
  async correct(record: RecordData, session: StewardSession): Promise<void> {
    const result = await session.reply(
      `Correct rejected dependency requests. No recipient or inbox action from this batch was committed. Preserve the requested result and acceptance criteria; correct the requested outcome or workflow within the recipient's existing authority. The recipient chooses its files. This coordination turn is source-read-only. Link only when the captured supplier intent covers your request. For distinct work keep the original criteria and use assignmentId=null. Return corrected requests and any retained inboxActions; explain any withdrawal. Host admission feedback: ${JSON.stringify(record.requestCorrection)}`,
    );
    record.pendingRequests = result.requests;
    record.pendingInboxActions = result.inboxActions ?? [];
    delete record.requestCorrection;
    save(this.root, record);
  }

  /** Uses canonical supplier identity for links and the ordinary resolver for distinct work. */
  private validate(
    sender: ExecutionAssignment,
    request: AgentResult['requests'][number],
    index: number,
  ): string[] {
    if (request.assignmentId !== null && request.assignmentId !== undefined)
      return this.shared(sender, request, index);
    try {
      if (!request.acceptanceCriteria.length)
        throw new InputError('Distinct new work requires acceptance criteria');
      new ExecutionContext().assignment(
        this.context,
        request.ownerId!,
        assignmentIntent(
          request.request,
          request.acceptanceCriteria,
          requestProposal(sender, request),
        ),
      );
      return [];
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      return [`Request ${index} to ${request.ownerId}: ${error.message}`];
    }
  }

  /** Rejects invalid supplier identities while leaving canonical contract resolution to the store. */
  private shared(
    sender: ExecutionAssignment,
    request: AgentResult['requests'][number],
    index: number,
  ): string[] {
    const owner = request.ownerId ?? '';
    if (!this.context.owners.includes(owner))
      return [`Request ${index} to ${owner}: supplier owner is not eligible in this run.`];
    const linked = this.store
      .assignments(sender.runId)
      .find((assignment) => assignment.id === request.assignmentId);
    if (!linked)
      return [
        `Request ${index} to ${owner}: invalid supplier assignment ${request.assignmentId}; it is unknown or outside this run.`,
      ];
    if (linked.id === sender.id)
      return [
        `Request ${index} to ${owner}: assignment ${linked.id} cannot link itself as a supplier.`,
      ];
    if (linked.owner !== owner)
      return [
        `Request ${index} to ${owner}: supplier assignment ${linked.id} belongs to ${linked.owner}.`,
      ];
    return [];
  }
}
