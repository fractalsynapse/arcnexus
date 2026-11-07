import { assertCapturedTestEdit } from '../testing/captured-tests.js';
import { relativePath } from '../architecture/config.js';
import { readSchema } from '../architecture/schema.js';
import { join } from 'node:path';
import { checkedEditAuthority } from './edit-recovery.js';
import { covered, classifyComponentPath } from '../architecture/components.js';
import type { BridgeTool } from '../steward/bridge.js';
import {
  CheckedEdits,
  EditIdentityError,
  StaleEditError,
  EditRequestError,
} from '../workspace/checked-edits.js';
import type { SessionState } from './session-state.js';
import { OperationEditProposals } from '../operations/operations.js';

/** Retains safe routing guidance after a completely rejected authority-boundary request. */
class EditRoutingError extends EditRequestError {
  /** Captures the accountable owner and next action without granting writes or creating inbox work. */
  constructor(
    readonly path: string,
    readonly ownerId: string,
    readonly recovery: string,
  ) {
    super(`File belongs to another owner: ${path}`);
  }
}

/** Exposes checked source mutation only through the active assignment's host-bound connection. */
export class CheckedEditBridge {
  readonly tools: BridgeTool[];

  private readonly edits: CheckedEdits;

  /** Captures authority independently of arguments supplied by an agent or its subprocesses. */
  constructor(private readonly state: SessionState) {
    const { record } = state.options;
    this.edits = new CheckedEdits(
      record.workspace,
      join(state.dir, 'checked-edits'),
      checkedEditAuthority(record),
      (path, content) => this.validateEdit(path, content),
    );
    this.tools = [
      {
        name: 'source.edit',
        description:
          'Apply owned edits through checked transactions. Supply id and changes with current SHA-256 hashes, using a fresh id for each distinct batch. Alternatively, when an operation returns editProposal, supply only proposalInvocationId to apply its complete pinned batch without copying diagnostic excerpts. Both forms enforce current ownership, stage and captured suite integrity. This is the only source write route.',
        inputSchema: {
          type: 'object',
          oneOf: [
            readSchema('checked-edits'),
            {
              type: 'object',
              additionalProperties: false,
              required: ['proposalInvocationId'],
              properties: { proposalInvocationId: { type: 'string', pattern: '^[a-f0-9-]{36}$' } },
            },
          ],
        },
      },
    ];
  }

  /** Resolves validated interrupted transactions before another activation may write source. */
  recover(): void {
    this.edits.recover();
  }

  /** Applies only this bridge's tool, retaining a host journal and exact content receipts. */
  call(name: string, args: unknown): unknown {
    if (name !== 'source.edit') throw new Error('Unknown edit tool');
    let receipt;
    try {
      receipt = this.edits.apply(this.request(args));
    } catch (error) {
      if (
        error instanceof StaleEditError ||
        error instanceof EditIdentityError ||
        error instanceof EditRequestError
      )
        return this.rejected(error);
      throw error;
    }
    this.state.journal(String(this.state.options.record.stage), 'source.edited', receipt);
    this.state.safe();
    return receipt;
  }

  /** Expands only an exact proposal reference from this assignment's completed operation evidence. */
  private request(args: unknown): unknown {
    if (!args || typeof args !== 'object' || !('proposalInvocationId' in args)) return args;
    if (Object.keys(args).length !== 1 || typeof args.proposalInvocationId !== 'string')
      throw new EditRequestError(
        'Supply only proposalInvocationId for a retained operation proposal',
      );
    const proposal = new OperationEditProposals(this.state.dir, this.state.options.record).resolve(
      args.proposalInvocationId,
    );
    if (!proposal)
      throw new EditRequestError('No completed edit proposal for this assignment invocation');
    return proposal;
  }

  /** Reports safe pre-transaction conflicts without relaxing authorization or uncertain recovery failures. */
  private rejected(error: StaleEditError | EditIdentityError | EditRequestError): unknown {
    const recovery =
      error instanceof EditRoutingError
        ? error.recovery
        : error instanceof StaleEditError
          ? 'No edits were applied. Reread the current bytes, compute SHA-256 and retry the complete batch.'
          : error instanceof EditRequestError
            ? 'No edits were applied. Use a completed proposalInvocationId from this assignment, or correct the direct request: create/update require complete replacement content; delete permits omitted or null content. Use each relative path once.'
            : 'No edits were applied. Use a fresh unique transaction ID for a different batch; reuse an ID only for an identical retry.';
    const rejection = {
      status: 'rejected',
      error: error.message,
      ...this.details(error),
      recovery,
    };
    this.state.journal(String(this.state.options.record.stage), 'source.edit_rejected', rejection);
    return rejection;
  }

  /** Describes only the observed conflict; tool feedback cannot select a new owner or assignment. */
  private details(error: StaleEditError | EditIdentityError | EditRequestError) {
    if (error instanceof EditRoutingError)
      return { path: error.path, ownerId: error.ownerId, reason: 'owner_boundary' };
    if (error instanceof StaleEditError)
      return {
        path: error.path,
        expectedSha256: error.expectedSha256,
        currentSha256: error.currentSha256,
      };
    if (error instanceof EditIdentityError) return { id: error.transactionId };
    return {};
  }

  /** Rejects selection changes as correctable input after enforcing the assignment's write authority. */
  private validateEdit(path: string, content: string | null): void {
    const kind = this.authorize(path);
    try {
      assertCapturedTestEdit(this.state.component, path, content, kind);
    } catch (error) {
      throw new EditRequestError(
        `Invalid test suite edit. Preserve captured test selection and use literal component, level and tags metadata. ${String(error)}`,
      );
    }
  }

  /** Permits writes only in engineering turns and only to the accountable component’s own files. */
  private authorize(path: string): string {
    const { record } = this.state.options;
    if (
      record.readOnlyTurn ||
      this.state.assignment.kind !== 'change' ||
      !['specification', 'implementation', 'correction'].includes(String(record.stage))
    )
      throw new Error('Source edits are forbidden in the current workflow stage');
    if (!covered(path, this.state.scope)) this.rejectBoundary(path);
    return classifyComponentPath(this.state.component, path);
  }

  /** Uses captured ownership only; known recipients receive inbox guidance, while unknown paths block. */
  private rejectBoundary(path: string): never {
    relativePath(path);
    const matches =
      this.state.resolved.ownership?.filter((owner) => covered(path, owner.paths)) ?? [];
    if (matches.length === 1 && matches[0]!.ownerId !== this.state.component.id) {
      this.delegate(path, matches[0]!);
    }
    throw new Error(
      `Edit outside component ownership: ${path}. Captured ownership is unknown or ambiguous; request an architectural decision without guessing a recipient.`,
    );
  }

  /** Names the actual steward and supplies the existing request protocol only when dispatch is permitted. */
  private delegate(path: string, recipient: { ownerId: string; eligible?: boolean }): never {
    const { ownerId: owner, eligible } = recipient;
    if (eligible === false)
      throw new EditRoutingError(
        path,
        owner,
        `No edits were applied. ${owner} owns this file but is outside the captured eligible team catalog. Report the architectural blocker with the requested change; do not dispatch unauthorized work.`,
      );
    throw new EditRoutingError(
      path,
      owner,
      `No edits were applied. Contact the ${owner} steward through the existing inbox protocol. First inspect assignment.evidence from the manifest and read the full intent for any matching existing ${owner} assignment. Link same accepted work with its assignmentId; describe your caller-specific need in request and use acceptanceCriteria=[] instead of copying supplier terms. The supplier's canonical accepted contract governs. Set milestone=delivered when required changes are needed. Request assignmentId=null with acceptance criteria only for distinct work. The host validates recipient and scope. Wait for verified delivery, not intent or acknowledgment. Do not edit this path yourself. If the owner is ineligible, report the architectural blocker.`,
    );
  }
}
