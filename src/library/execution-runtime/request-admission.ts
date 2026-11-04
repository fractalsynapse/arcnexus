import {
  requestProposal,
  sharedRequestProblem,
  type ExecutionStore,
} from '../coordination-store/execution-store.js';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import { assignmentIntent } from './assignment-intent.js';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';
import type { StewardSession } from '../assignment/steward.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { ProgressObserver } from '../report/progress.js';
import type { AgentResult } from '../steward/codex.js';
import { save, type RecordData } from '../workspace/state.js';

/** Rejects invalid new dependency intent before recipients exist and retains a read-only correction checkpoint. */
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

  /** Shared-work links retain store matching rules; new known owners must pass the ordinary resolver. */
  private validate(
    sender: ExecutionAssignment,
    request: AgentResult['requests'][number],
    index: number,
  ): string[] {
    if (request.assignmentId) return this.shared(sender, request, index);
    try {
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

  /** Leaves unknown supplier identities to routing and corrects conflicting terms on a known link. */
  private shared(
    sender: ExecutionAssignment,
    request: AgentResult['requests'][number],
    index: number,
  ): string[] {
    const linked = this.store
      .assignments(sender.runId)
      .find((a) => a.id === request.assignmentId && a.owner === request.ownerId);
    if (!linked) return [];
    const mismatch = sharedRequestProblem(this.store.effective(linked.id), {
      owner: linked.owner,
      objective: request.request,
      acceptance: request.acceptanceCriteria,
      kind: request.kind,
      changeType: request.changeType,
    });
    return mismatch ? [`Request ${index} to ${linked.owner}: ${mismatch}`] : [];
  }
}
