import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks pre-freeze quality selection and distinguishes correctable failures from unsafe execution. */
class SpecificationQualityScenarios {
  /** Uses the assembled session entry point to prove a failed quality check cannot freeze sources. */
  async ordering(t: TestContext): Promise<void> {
    const { state, failure } = this.fixture(t);
    const path = '../../../../dist/library/assignment/session-verification.js';
    const { SessionVerification } = await import(path);
    const verification = new SessionVerification(state);
    verification.captureRegression = () => assert.fail('Failed quality must not freeze tests');
    state.checks = async () => {
      throw failure;
    };
    await assert.rejects(verification.specification({}), /source quality must pass/);
    assert.equal(state.specificationFinished, undefined);
    assert.equal(state.options.record.frozenTests, undefined);
  }

  /** Runs only mandatory lint checks, then permits the same corrected sources to progress. */
  async correction(t: TestContext): Promise<void> {
    const { state, failure } = this.fixture(t);
    const { SpecificationQuality } = await this.runtime();
    const calls: any[] = [];
    let failed = true;
    state.checks = async (checks: any[], stage: string) => {
      calls.push({ checks, stage });
      if (failed) throw failure;
    };
    const quality = new SpecificationQuality(state);
    await assert.rejects(quality.verify(), (error: any) => {
      assert.equal(error.name, 'SpecificationValidationError');
      assert.match(error.feedback, /FORMAT_REQUIRED/);
      return true;
    });
    failed = false;
    await quality.verify();
    assert.deepEqual(
      calls.map((call) => call.checks.map((check: any) => check.id)),
      [['format'], ['format']],
    );
    assert.ok(calls.every((call) => call.stage === 'specification-quality'));
  }

  /** Cancellation, uncertain transport and invalid scope never become safe specification retries. */
  async unsafe(t: TestContext): Promise<void> {
    const { state, failure } = this.fixture(t);
    const { SpecificationQuality } = await this.runtime();
    const uncertain = new Error('Operation completion unknown');
    state.checks = async () => {
      throw uncertain;
    };
    await assert.rejects(new SpecificationQuality(state).verify(), (error) => error === uncertain);
    state.checks = async () => {
      throw failure;
    };
    state.safe = () => {
      throw uncertain;
    };
    await assert.rejects(new SpecificationQuality(state).verify(), (error) => error === uncertain);
    const controller = new AbortController();
    controller.abort(new Error('Cancelled'));
    state.options.signal = controller.signal;
    await assert.rejects(new SpecificationQuality(state).verify(), /Cancelled/);
  }

  /** Supplies no implicit command when captured authority contains no mandatory static checks. */
  async absent(t: TestContext): Promise<void> {
    const { state } = this.fixture(t);
    const { SpecificationQuality } = await this.runtime();
    state.component.verification = [{ id: 'tests', category: 'test' }];
    state.checks = () => assert.fail('Do not infer check authority');
    await new SpecificationQuality(state).verify();
  }

  /** Retains an actual completed-command log while isolating only the operation execution boundary. */
  private fixture(t: TestContext): any {
    const directory = mkdtempSync(join(tmpdir(), 'specification-quality-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const log = join(directory, 'quality.log');
    writeFileSync(log, 'FORMAT_REQUIRED');
    const failure = Object.assign(new Error('Check failed'), {
      observedExitFailure: true,
      operationId: 'format',
      commandResult: { exitCode: 1, log },
    });
    const state = {
      component: {
        verification: [
          { id: 'format', category: 'lint' },
          { id: 'tests', category: 'test' },
        ],
      },
      resolved: { operations: [{ id: 'agent-formatter', category: 'lint' }] },
      assignment: { kind: 'change', changeType: 'behavior' },
      options: { record: {}, signal: new AbortController().signal },
      /** Represents a valid retained scope at the operation boundary. */
      safe() {},
      ownChanges: () => ['tests/spec.ts'],
    };
    return { state, failure };
  }

  /** Loads the built implementation rather than a test copy of its selection logic. */
  private async runtime(): Promise<any> {
    const path = '../../../../dist/library/assignment/specification-quality.js';
    return import(path);
  }
}

const scenarios = new SpecificationQualityScenarios();

test('specification quality fails before regression freezing', (t) => scenarios.ordering(t));

test('corrected specification uses only captured mandatory quality operations', (t) =>
  scenarios.correction(t));

test('unsafe specification quality execution remains unsafe', (t) => scenarios.unsafe(t));

test('specification quality does not invent mandatory commands', (t) => scenarios.absent(t));

registerSuite({ component: 'assignment', level: 'unit', tags: ['deterministic'] });
