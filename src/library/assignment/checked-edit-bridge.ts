import { assertCapturedTestEdit } from '../testing/captured-tests.js';
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
          'Apply owned edits through checked transactions. Supply id and changes with current SHA-256 hashes, using a fresh id for each distinct batch. Alternatively, when an operation returns editProposal, supply only proposalInvocationId to apply its complete pinned batch without copying diagnostic excerpts. Both forms enforce current ownership, stage and frozen-test authority. This is the only source write route.',
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
    const conflict =
      error instanceof StaleEditError
        ? {
            path: error.path,
            expectedSha256: error.expectedSha256,
            currentSha256: error.currentSha256,
          }
        : error instanceof EditIdentityError
          ? { id: error.transactionId }
          : {};
    const recovery =
      error instanceof StaleEditError
        ? 'No edits were applied. Reread the current bytes, compute SHA-256 and retry the complete batch.'
        : error instanceof EditRequestError
          ? 'No edits were applied. Use a completed proposalInvocationId from this assignment, or correct the direct request: create/update require complete replacement content; delete permits omitted or null content. Use each relative path once.'
          : 'No edits were applied. Use a fresh unique transaction ID for a different batch; reuse an ID only for an identical retry.';
    const rejection = { status: 'rejected', error: error.message, ...conflict, recovery };
    this.state.journal(String(this.state.options.record.stage), 'source.edit_rejected', rejection);
    return rejection;
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

  /** Enforces narrowing, workflow stage and frozen regression authority before any file is modified. */
  private authorize(path: string): string {
    const { record } = this.state.options;
    if (
      record.readOnlyTurn ||
      this.state.assignment.kind !== 'change' ||
      !['specification', 'implementation', 'correction'].includes(String(record.stage))
    )
      throw new Error('Source edits are forbidden in the current workflow stage');
    if (!covered(path, this.state.scope))
      throw new Error(`Edit outside active assignment: ${path}`);
    const kind = classifyComponentPath(this.state.component, path);
    if (this.state.documentationOnly && kind !== 'documentation')
      throw new Error(`Documentation assignment cannot edit ${kind}: ${path}`);
    if (record.stage === 'specification' && !['documentation', 'tests'].includes(kind))
      throw new Error(`Specification cannot edit ${kind}: ${path}`);
    if (record.stage !== 'specification' && this.state.frozen.some((test) => test.path === path))
      throw new Error(`Implementation cannot change frozen regression: ${path}`);
    return kind;
  }
}
