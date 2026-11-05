import { isObservedCommandFailure } from '../operations/process.js';
import type { VerificationCheck } from '../architecture/config.js';
import type { Operation } from '../operations/operations.js';
import { logExcerpt } from './attempts.js';
import type { SessionState } from './session-state.js';
import { SpecificationValidationError } from './specification-error.js';

/** Validates mandatory static quality while specification sources remain correctable. */
export class SpecificationQuality {
  /** Uses captured verification definitions and the ordinary supervised checkpoint executor. */
  constructor(private readonly state: SessionState) {}

  /** Returns observed quality failures to specification correction without replaying uncertain work. */
  async verify(): Promise<void> {
    const checks = this.state.component.verification.filter(
      (check) => (check as Operation).category === 'lint',
    );
    return this.check(checks, 'specification-quality', 'Specification source quality');
  }

  /** Keeps all captured passing-characterization checks mandatory while returning observed deficiencies for correction. */
  characterization(): Promise<void> {
    return this.check(
      this.state.component.verification,
      'characterization-before',
      'Characterization',
    );
  }

  /** Distinguishes actionable command failures from uncertain execution before any source evidence is frozen. */
  private async check(
    checks: VerificationCheck[],
    stage: string,
    requirement: string,
  ): Promise<void> {
    if (!checks.length) return;
    try {
      await this.state.checks(checks, stage);
      this.state.safe();
    } catch (error) {
      this.state.options.signal.throwIfAborted();
      if (!isObservedCommandFailure(error)) throw error;
      this.state.safe();
      const failed = error.commandResult;
      const diagnostic = logExcerpt(failed.log);
      throw new SpecificationValidationError(
        `Correct specification source quality before regression freezing. Exit ${failed.exitCode}: ${diagnostic}; retained log: ${failed.log}`,
        (stage === 'specification-quality' ? 'source-quality' : stage) +
          ':' +
          (error.operationId ?? JSON.stringify(failed.args)),
        requirement + ' must pass before freezing regression sources: ' + diagnostic,
      );
    }
  }
}
