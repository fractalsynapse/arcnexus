import { SpecificationValidationError } from './specification-error.js';
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

  /** Resolves current stable identities; historical index evidence is inspectable but never executable. */
  select(regression: AgentResult['regression']): VerificationCheck {
    if (this.component.schemaVersion !== 6)
      throw new Error('Regression execution requires version-six authority; migrate configuration');
    if (!regression) throw new Error('Missing regression checkpoint');
    if (!('operationId' in regression)) throw new Error('Regression requires operationId');
    const operation = this.component.verification.find(
      (command) => (command as Operation).id === regression.operationId,
    ) as Operation | undefined;
    if (operation && operation.schemaVersion !== 4)
      throw new Error('Regression operation has invalid captured schema');
    if (!operation || operation.kind === 'service') this.rejectSelection();
    return operation;
  }

  /** Returns only finite captured verification choices; this never grants agent-only authority. */
  private rejectSelection(): never {
    const ids = this.component.verification
      .map((entry) => entry as Operation)
      .filter((entry) => entry.schemaVersion === 4 && entry.kind !== 'service')
      .map((entry) => entry.id);
    const message =
      'Regression operation is not a captured verification operation (finite required)';
    throw new SpecificationValidationError(
      `${message}. Select one of: ${JSON.stringify(ids)}. No regression operation was executed.`,
      'operation-selection',
      message,
    );
  }

  /** Rejects prerequisite failures and freezes the selected operation's actual host invocation context. */
  capture(command: VerificationCheck, result: CommandResult): void {
    if (this.component.schemaVersion !== 6)
      throw new Error('Regression capture requires version-six authority');
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
