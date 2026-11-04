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
      (path) => this.authorize(path),
    );
    this.tools = [
      {
        name: 'source.edit',
        description:
          'Apply an idempotent batch of owned source edits. Use a fresh unique transaction ID for each distinct batch, not an owner or assignment ID; reuse it only for an identical retry. Read bytes first and supply current SHA-256 hashes. This is the only source write route.',
        inputSchema: readSchema('checked-edits'),
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
      receipt = this.edits.apply(args);
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
          ? 'No edits were applied. Correct the request shape: create/update require complete replacement content; delete permits omitted or null content. Use each relative path once.'
          : 'No edits were applied. Use a fresh unique transaction ID for a different batch; reuse an ID only for an identical retry.';
    const rejection = { status: 'rejected', error: error.message, ...conflict, recovery };
    this.state.journal(String(this.state.options.record.stage), 'source.edit_rejected', rejection);
    return rejection;
  }

  /** Enforces narrowing, workflow stage and frozen regression authority before any file is modified. */
  private authorize(path: string): void {
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
  }
}
