import { InputError } from '../architecture/config.js';
import { OperationExecution } from '../operations/operation-execution.js';
import type { Operation } from '../operations/operations.js';
import { prepareCapabilities } from '../operations/probes.js';
import type { InitializationSnapshot } from '../architecture/initialization.js';
import { candidateDigest } from '../change-inspection/changes.js';
import type { CommandResult } from '../operations/process.js';
import { save, type RecordData } from '../workspace/state.js';
import { assertIdentity, assertOutputs } from '../workspace/workspace.js';

/** Verifies intake prerequisites and enforces its source-read-only boundary. */
export class InitializerChecks {
  /** Retains captured initialization authority for post-turn scope and identity checks. */
  constructor(
    private root: string,
    private record: RecordData,
    private snapshot: InitializationSnapshot,
  ) {}

  /** Runs captured intake verification before model activation. */
  async verify(signal: AbortSignal): Promise<void> {
    if (this.snapshot.context.some((owner) => owner.schemaVersion !== 5))
      throw new InputError(
        'Initializer checks require version-five authority; migrate configuration',
      );
    const before = candidateDigest(this.record);
    await prepareCapabilities(this.root, this.record, signal);
    this.unchanged(before);
    await this.shared(signal, before);
  }

  /** Runs minimal intake verification with source confinement and one prerequisite checkpoint. */
  private async shared(signal: AbortSignal, before: string): Promise<void> {
    const offset = (this.record.operationInvocations as unknown[] | undefined)?.length ?? 0;
    const operations = this.snapshot.context.at(-1)!.verification as Operation[];
    try {
      await new OperationExecution(this.root, this.record, signal).checkpoint(
        operations,
        'initializer-verification',
      );
    } finally {
      const invocations = this.record.operationInvocations as
        Array<{ result?: CommandResult }> | undefined;
      for (const invocation of invocations?.slice(offset) ?? [])
        if (invocation.result)
          this.record.commands.push({ ...invocation.result, stage: 'initializer-verification' });
      save(this.root, this.record);
      this.unchanged(before);
    }
  }

  /** Rejects unexpected source changes after a read-only or preparation activity. */
  unchanged(before: string): void {
    assertIdentity(this.record);
    if (candidateDigest(this.record) !== before)
      throw new Error('Read-only initializer changed source');
    assertOutputs(this.record.workspace, this.record.environment);
  }
}
