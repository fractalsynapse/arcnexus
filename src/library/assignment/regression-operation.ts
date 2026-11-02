import type { Component } from '../architecture/components.js';
import type { VerificationCheck } from '../architecture/config.js';
import type { Operation } from '../operations/operations.js';
import type { CommandResult } from '../operations/process.js';
import type { AgentResult } from '../steward/codex.js';
import type { RecordData } from '../workspace/state.js';

/** Resolves expected-red checks from captured authority and retains observed invocation evidence. */
export class RegressionOperation {
  /** Keeps candidate-written expectations separate from immutable verification definitions. */
  constructor(
    private readonly component: Component,
    private readonly record: RecordData,
  ) {}

  /** Supports historical index evidence while requiring stable operation identities for minimal components. */
  select(regression: AgentResult['regression']): VerificationCheck {
    if (!regression) throw new Error('Missing regression checkpoint');
    if (this.component.schemaVersion === 5) {
      if (!('operationId' in regression)) throw new Error('Regression requires operationId');
      const operation = this.component.verification.find(
        (command) => (command as Operation).id === regression.operationId,
      ) as Operation | undefined;
      if (!operation || operation.schemaVersion !== 4 || operation.kind === 'service')
        throw new Error(
          'Regression operation is not a captured verification operation (finite required)',
        );
      return operation;
    }
    const command =
      'verificationIndex' in regression
        ? this.component.verification[regression.verificationIndex]
        : undefined;
    if (!command) throw new Error('Missing/invalid historical regression checkpoint');
    return command;
  }

  /** Rejects prerequisite failures and freezes the selected operation's actual host invocation context. */
  capture(command: VerificationCheck, result: CommandResult): void {
    if (this.component.schemaVersion !== 5) return;
    const operation = command as Operation;
    const invocations = this.record.operationInvocations as Array<Record<string, any>> | undefined;
    const invocation = invocations?.findLast((entry) => entry.result?.log === result.log);
    if (
      !invocation ||
      invocation.operationId !== operation.id ||
      invocation.definitionDigest !== operation.definitionDigest ||
      invocation.context?.ownerId !== this.component.id ||
      invocation.status !== 'failed' ||
      invocation.result?.log !== result.log ||
      invocation.result?.exitCode !== result.exitCode
    )
      throw new Error('Expected failure was not observed from the selected regression operation');
    this.record.regressionInvocation = structuredClone(invocation);
  }
}
