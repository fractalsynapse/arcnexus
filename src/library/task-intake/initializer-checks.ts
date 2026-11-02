import { OperationExecution } from '../operations/operation-execution.js';
import type { Operation } from '../operations/operations.js';
import { prepareCapabilities } from '../operations/probes.js';
import { join } from 'node:path';
import { targetCommand } from '../architecture/bindings.js';
import { milliseconds } from '../architecture/config.js';
import type { InitializationSnapshot } from '../architecture/initialization.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { operationEnvironment } from '../operations/operations.js';
import { execute, type CommandResult } from '../operations/process.js';
import { observe } from '../report/timeline.js';
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
    const before = candidateDigest(this.record);
    await prepareCapabilities(this.root, this.record, signal);
    this.unchanged(before);
    if (this.snapshot.context.at(-1)!.schemaVersion === 5) return this.shared(signal, before);
    for (const command of this.snapshot.context.at(-1)!.verification) {
      observe(this.root, this.record, 'initializer.check.started', command);
      try {
        const result = await this.command(command, signal);
        this.record.commands.push({ ...result, stage: 'initializer-verification' });
        observe(this.root, this.record, 'initializer.check.completed', result);
      } catch (error) {
        if (error && typeof error === 'object' && 'commandResult' in error)
          this.record.commands.push({
            ...(error.commandResult as CommandResult),
            stage: 'initializer-verification',
          });
        throw error;
      } finally {
        save(this.root, this.record);
        this.unchanged(before);
      }
    }
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

  /** Executes one intake check with cancellation and retained command evidence. */
  private command(
    command: import('../architecture/config.js').VerificationCheck,
    signal: AbortSignal,
  ) {
    if (!('command' in command)) throw new Error('Legacy verification requires a command');
    return execute(
      targetCommand(this.record, command),
      this.record.workspace,
      join(
        this.root,
        'runs',
        this.record.id,
        `initializer-check-${this.record.commands.length}.log`,
      ),
      signal,
      {
        env: operationEnvironment(this.record),
        timeoutMs: milliseconds(this.snapshot.profile.commandTimeoutSeconds),
      },
    );
  }

  /** Rejects unexpected source changes after a read-only or preparation activity. */
  unchanged(before: string): void {
    assertIdentity(this.record);
    if (candidateDigest(this.record) !== before)
      throw new Error('Read-only initializer changed source');
    assertOutputs(this.record.workspace, this.record.environment);
  }
}
