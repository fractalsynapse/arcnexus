import type { ResolvedAssignment } from '../architecture/assignment.js';
import type { VerificationCheck } from '../architecture/config.js';
import { CapturedVerification } from '../assignment/steward.js';
import { OperationExecution } from '../operations/operation-execution.js';
import type { Operation } from '../operations/operations.js';
import type { CommandResult } from '../operations/process.js';
import { save, type RecordData } from '../workspace/state.js';

/** Applies existing captured acceptance to combined source without lending worker write permissions. */
export class AssemblyAcceptance {
  /** Shares the assembled host record and cancellation boundary with ordinary delivery checks. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly signal: AbortSignal,
  ) {}

  /** Preserves original command authority, verified tests, and captured refactor characterization. */
  async verify(contributions: RecordData[], baseline: string): Promise<void> {
    for (const source of contributions) {
      const resolved = source.resolvedAssignment as ResolvedAssignment;
      if (!resolved || source.executionRunId !== this.record.executionRunId)
        throw new Error('Assembly acceptance requires matching captured assignment authority');
      const component = { ...resolved.context.at(-1)!, verification: resolved.verification };
      const record = {
        ...this.record,
        generalExecution: true,
        characterization: source.characterization,
        frozenTests: source.frozenTests,
        verifiedTestPaths: this.record.verifiedTestPaths,
        trustedVerificationPaths: source.trustedVerificationPaths,
      };
      await new CapturedVerification({
        record,
        component,
        authorityBase: resolved.base,
        verifiedBase: baseline,
        checks: (checks, stage) => this.checks(checks, stage),
      }).verify();
    }
  }

  /** Retains every completed command even when a later check fails, using the shared executor. */
  private async checks(checks: VerificationCheck[], stage: string): Promise<void> {
    const offset = (this.record.operationInvocations as unknown[] | undefined)?.length ?? 0;
    try {
      await new OperationExecution(this.root, this.record, this.signal).checkpoint(
        checks as Operation[],
        stage,
      );
    } finally {
      const invocations = this.record.operationInvocations as
        Array<{ result?: CommandResult }> | undefined;
      for (const invocation of invocations?.slice(offset) ?? [])
        if (invocation.result) this.record.commands.push({ ...invocation.result, stage });
      save(this.root, this.record);
    }
  }
}
