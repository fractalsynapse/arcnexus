import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  verdictAgrees,
  type VerdictAgreement,
  type VerificationVerdict,
} from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import type { CheckResult } from '../../../../dist/library/operations/check-result.js';

const result: CheckResult = {
  status: 'passed',
  evidence: ['report.json'],
  artifacts: [],
};

/** A recorded verdict for one candidate digest and one captured input key. */
function verdict(overrides: Partial<VerificationVerdict> = {}): VerificationVerdict {
  return {
    key: 'inputs-a',
    digest: 'bytes-a',
    independent: true,
    result,
    ...overrides,
  };
}

/** The facts a verdict is compared against on a later read. */
function agreement(overrides: Partial<VerdictAgreement> = {}): VerdictAgreement {
  return {
    key: 'inputs-a',
    digest: 'bytes-a',
    independent: true,
    completed: true,
    sameRun: true,
    workspacePresent: true,
    evidencePresent: true,
    artifactsPresent: true,
    ...overrides,
  };
}

/** Anchors the single-gate reuse rule: one content-addressed verdict, no second gate. */
class VerificationVerdictScenario {
  /** Reads the recorded verdict when the candidate bytes and captured inputs are unchanged. */
  reusesIdenticalInputs(): void {
    assert.equal(verdictAgrees(verdict(), agreement()), true);
    assert.equal(
      verdictAgrees(verdict(), agreement({ independent: false })),
      true,
      'an unreviewed reader may reuse a reviewed verdict, never the reverse',
    );
  }

  /** Invalidates the verdict when any candidate byte changes, so a new gate is required. */
  changedBytesInvalidate(): void {
    assert.equal(verdictAgrees(verdict(), agreement({ digest: 'bytes-b' })), false);
  }

  /** Invalidates the verdict when source, authority, environment, goal or acceptance changes. */
  changedInputsInvalidate(): void {
    assert.equal(verdictAgrees(verdict(), agreement({ key: 'inputs-b' })), false);
  }

  /** Refuses to reuse a verdict that never carried the independent reviewer a gate requires. */
  reviewerCoverageRequired(): void {
    assert.equal(verdictAgrees(verdict({ independent: false }), agreement()), false);
    assert.equal(
      verdictAgrees(verdict({ independent: false }), agreement({ independent: false })),
      true,
    );
  }

  /** Refuses a verdict whose candidate, run, workspace or evidence no longer exists. */
  missingFactsInvalidate(): void {
    for (const field of [
      'completed',
      'sameRun',
      'workspacePresent',
      'evidencePresent',
      'artifactsPresent',
    ] as const)
      assert.equal(
        verdictAgrees(verdict(), agreement({ [field]: false })),
        false,
        field + ' must be present for reuse',
      );
  }

  /** Treats an absent verdict as no verdict rather than throwing. */
  absentVerdict(): void {
    assert.equal(verdictAgrees(undefined, agreement()), false);
  }
}

const scenario = new VerificationVerdictScenario();

test('an unchanged candidate reuses its one recorded verdict', () =>
  scenario.reusesIdenticalInputs());

test('changed candidate bytes invalidate the recorded verdict', () =>
  scenario.changedBytesInvalidate());

test('changed authority, environment, goal or acceptance invalidates the verdict', () =>
  scenario.changedInputsInvalidate());

test('a verdict without reviewer coverage is never reused by a gate that requires it', () =>
  scenario.reviewerCoverageRequired());

test('a verdict missing candidate, run, workspace or evidence facts is never reused', () =>
  scenario.missingFactsInvalidate());

test('an absent verdict reads as no verdict', () => scenario.absentVerdict());

registerSuite({ component: 'publisher', level: 'unit', tags: ['deterministic', 'verification'] });
