import { isObservedCommandFailure } from '../operations/process.js';
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
    if (!checks.length) return;
    try {
      await this.state.checks(checks, 'specification-quality');
      this.state.safe();
    } catch (error) {
      this.state.options.signal.throwIfAborted();
      if (!isObservedCommandFailure(error)) throw error;
      this.state.safe();
      const failed = error.commandResult;
      throw new SpecificationValidationError(
        `Correct specification source quality before regression freezing. Exit ${failed.exitCode}: ${logExcerpt(failed.log)}; retained log: ${failed.log}`,
        'source-quality:' + (error.operationId ?? JSON.stringify(failed.args)),
        'Specification source quality must pass before freezing regression sources',
      );
    }
  }
}
