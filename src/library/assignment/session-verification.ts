import { RegressionOperation } from './regression-operation.js';
import { digest } from '../architecture/assignment.js';
import { SpecificationValidationError } from './specification-error.js';
import { SpecificationQuality } from './specification-quality.js';
import { logExcerpt } from './attempts.js';
import { RefactorCheckpoint } from './refactor-checkpoint.js';
import { assertCapturedTests } from '../testing/captured-tests.js';
import { SessionProgress } from './session-progress.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidateDigest } from '../change-inspection/changes.js';
import { isObservedCommandFailure, type CommandResult } from '../operations/process.js';
import { type AgentResult } from '../steward/codex.js';
import { specificationFiles } from './checkpoints.js';
import { SessionState } from './session-state.js';

/** Enforces expected-red evidence and captured acceptance without elevating worker tests to authority. */
export class SessionVerification {
  /** Uses captured session checks and scope for authoritative verification. */
  constructor(private readonly state: SessionState) {}

  /** Freezes regression files and requires the declared expected-red checkpoint. */
  async specification(spec: AgentResult) {
    if (this.state.assignment.changeType === 'refactor')
      return new RefactorCheckpoint(this.state).prepare();
    if (!this.state.ownChanges().length) {
      this.state.options.record.status = 'no_changes';
      this.state.options.record.outcome = 'no_changes';
      throw new Error('Candidate has no changes');
    }
    await new SpecificationQuality(this.state).verify();
    this.captureRegression();
    if (!this.state.documentationOnly) await this.regression(spec);
    else
      this.state.journal('testing', 'skipped', {
        reason:
          'Caller declared documentation-only assignment; project verification remains required',
      });

    this.state.specificationFinished = true;
    this.state.checkpoint();
    new SessionProgress(this.state).verified('specification');
  }

  /** Freezes the specification files outside the candidate before implementation. */
  private captureRegression(): void {
    this.state.frozen = specificationFiles(
      this.state.options.record,
      this.state.component,
      this.state.documentationOnly,
      this.state.ownChanges(),
    );
    this.state.options.record.frozenTests = this.state.frozen;
    writeFileSync(
      join(this.state.dir, 'frozen-tests.json'),
      JSON.stringify(this.state.frozen, null, 2) + '\n',
      {
        mode: 0o600,
      },
    );
  }

  /** Matches the observed failure to the steward’s declared diagnostic. */
  private async regression(spec: AgentResult): Promise<void> {
    this.state.regression = spec.regression;
    if (!this.state.regression) throw new Error('Missing regression checkpoint');
    new RegressionOperation(this.state.component, this.state.options.record).select(
      this.state.regression,
    );
    const failed = await this.expectedFailure();
    this.state.safe();
    if (
      !failed ||
      failed.exitCode !== this.state.regression.exitCode ||
      !readFileSync(failed.log, 'utf8').includes(this.state.regression.outputIncludes)
    )
      throw new SpecificationValidationError(
        `Expected ${JSON.stringify(this.state.regression)}; observed ${failed ? `exit ${failed.exitCode}: ${logExcerpt(failed.log)}; full retained log: ${failed.log}` : 'successful command, so no failing assertion was observed'}`,
        digest(JSON.stringify([this.state.regression, this.state.frozen, failed?.exitCode ?? 0])),
      );
    this.state.options.record.regressionCheckpoint = this.state.regression;
    this.state.journal('testing', 'completed', {
      host: 'expected regression failure observed',
      regression: this.state.regression,
    });
  }

  /** Runs the declared regression and retains its diagnostic for the red checkpoint. */
  private async expectedFailure(): Promise<CommandResult | undefined> {
    let failed: CommandResult | undefined;
    const selection = new RegressionOperation(this.state.component, this.state.options.record);
    const command = selection.select(this.state.regression);
    try {
      await this.state.command(command, 'red-test');
    } catch (error) {
      this.state.options.signal.throwIfAborted();
      if (isObservedCommandFailure(error)) failed = error.commandResult as CommandResult;
      else throw error;
    }
    if (failed) selection.capture(command, failed);
    return failed;
  }

  /** Runs the owner's declared verification once, then the host's acceptance checks. */
  async final() {
    this.prepare();
    const { record } = this.state.options;
    if (
      record.generalExecution &&
      record.finalVerifiedBase === record.base &&
      record.finalVerifiedDigest === candidateDigest(record)
    )
      return;
    assertCapturedTests(this.state.component, this.state.options.record.workspace);
    await this.state.checks(this.state.component.verification, 'verification');
    assertCapturedTests(this.state.component, this.state.options.record.workspace);
    this.state.safe();
    await this.state.checks(this.state.hostChecks, 'acceptance');
    this.prepare();
    record.finalVerifiedDigest = candidateDigest(record);
    record.finalVerifiedBase = record.base;
    new SessionProgress(this.state).verified('final-verification');
  }

  /** Requires an in-scope implementation both before checks and after their side effects. */
  prepare(): void {
    this.state.safe();
    if (this.state.assignment.kind === 'change' && !this.state.ownChanges().length) {
      this.state.options.record.status = 'no_changes';
      this.state.options.record.outcome = 'no_changes';
      throw new Error('Candidate has no changes');
    }
  }
}
