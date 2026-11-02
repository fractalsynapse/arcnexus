import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture as workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises workflow behavior through observable scenarios. */
class WorkflowTests {
  /** Verifies that planning and engineering preserve the retained model thread. */
  builtCLIPerformsPlannedCheckedTurnsOnOneThread(t: TestContext) {
    const f = workflowFixture(t),
      r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.equal(v.outcome, 'ready_for_integration');
    assert.deepEqual(
      v.turns.map((x: any) => x.activity),
      ['planning', 'specification', 'implementation', 'review'],
    );
    assert.equal(v.implementationAttempts, 1);
    assert.equal(v.usage.input_tokens, 40);
    assert.equal(readFileSync(join(v.workspace, 'source.txt'), 'utf8'), 'after');
    assert.ok(existsSync(join(f.state, 'runs', v.id, 'activities.jsonl')));
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line: string) => JSON.parse(line));
    assert.ok(calls[1].args.includes('resume'));
    assert.ok(calls[2].args.includes('workflow-thread'));
  }

  /** Verifies the scenario completes read only assignment. */
  completesReadOnlyAssignment(t: TestContext, kind: any) {
    const f = workflowFixture(t),
      r = f.run('--kind', kind);
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.equal(v.outcome, kind + '_completed');
    assert.equal(v.changes.length, 0);
    assert.equal(v.turns.length, 2);
  }

  /** Verifies the scenario rejects invalid workflow result. */
  rejectsInvalidWorkflowResult(t: TestContext, mode: any) {
    const f = workflowFixture(t, mode),
      r = f.run();
    assert.equal(r.status, 1, r.stderr);
    assert.notEqual(JSON.parse(r.stdout).status, 'completed');
  }

  /** Late failure diagnostics reach the corrective turn through the real SDK boundary. */
  lateFailureReachesCorrection(t: TestContext): void {
    const f = workflowFixture(t, 'repair');
    const verify = join(f.repo, 'verify.cjs');
    const original = readFileSync(verify, 'utf8');
    writeFileSync(
      verify,
      "require('fs').writeSync(1,'passing output\\n'.repeat(12000));" +
        "if(require('fs').readFileSync('source.txt','utf8')==='broken')throw new Error('LATE_ACTUAL_FAILURE');" +
        original,
    );
    f.configure({ requiredFeedback: 'LATE_ACTUAL_FAILURE' });
    f.commit();
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const correction = calls.find((call) => call.stage === 'correction');
    assert.match(correction.prompt, /LATE_ACTUAL_FAILURE/);
    assert.match(correction.prompt, /Full retained log:/);
  }

  /** Verifies that automatic repair preserves frozen tests and cumulative usage. */
  automaticRepairPreservesFrozenTestsAndCumulativeUsage(t: TestContext) {
    const f = workflowFixture(t, 'repair'),
      r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.deepEqual(
      v.turns.map((x: any) => x.activity),
      ['planning', 'specification', 'implementation', 'correction', 'review'],
    );
    assert.equal(v.implementationAttempts, 2);
    assert.equal(v.usage.input_tokens, 50);
    assert.deepEqual(
      v.turns.map((x: any) => x.usage.input_tokens),
      [10, 10, 10, 10, 10],
    );
  }

  /** Verifies that review can request correction without an attempt allowance. */
  reviewCanRequestCorrectionWithoutAnAttemptAllowance(t: TestContext) {
    const f = workflowFixture(t, 'review-repair'),
      r = f.run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).turns.length, 6);
  }

  /** Verifies that a weakened current test cannot replace frozen acceptance. */
  aWeakenedCurrentTestCannotReplaceFrozenAcceptance(t: TestContext) {
    const f = workflowFixture(t, 'weak-test');
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      "if(require('fs').existsSync('tests/regression.cjs'))require('./tests/regression.cjs');",
    );
    f.commit();
    const r = f.run();
    assert.equal(r.status, 1);
    const record = JSON.parse(r.stdout);
    assert.equal(record.outcome, 'needs_attention');
    assert.equal(
      readFileSync(join(record.workspace, 'tests/regression.cjs'), 'utf8'),
      '// weakened test',
    );
    const failures = record.operationInvocations.filter(
      (invocation: any) =>
        invocation.purpose === 'frozen-regression' && invocation.result?.exitCode === 1,
    );
    assert.ok(failures.length >= 3);
    for (const invocation of failures)
      assert.match(readFileSync(invocation.result.log, 'utf8'), /BOUNDARY_EXPECTED/);
  }

  /** Retains a valid owner request for deterministic scheduler delivery without calling it a failed activation. */
  ownerRequestYieldsSafeWaitingCheckpoint(t: TestContext, mode = 'blocked') {
    const f = workflowFixture(t, mode),
      r = f.run();
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.equal(v.outcome, 'waiting');
    assert.equal(v.safeCheckpoint, true);
    const owner = mode === 'unknown-owner' ? 'missing' : 'dependency';
    assert.equal(v.pendingRequests[0].ownerId, owner);
    assert.equal(v.requests[0].ownerId, owner);
    assert.equal(v.turns.length, 1);
  }

  /** Verifies that unchanged change assignment is explicitly no changes. */
  unchangedChangeAssignmentIsExplicitlyNoChanges(t: TestContext) {
    const f = workflowFixture(t, 'no-changes'),
      r = f.run();
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).outcome, 'no_changes');
  }

  /** Verifies the scenario preserves git change evidence. */
  preservesGitChangeEvidence(t: TestContext, mode: any) {
    const f = workflowFixture(t, mode),
      r = f.run();
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.ok(v.stagedChanges.some((c: any) => c.path === 'source.txt'));
    if (mode === 'rename') {
      assert.ok(v.changes.some((c: any) => c.path === 'new.txt'));
      assert.ok(v.changes.some((c: any) => c.kind === 'D'));
    } else assert.ok(v.unstagedChanges.some((c: any) => c.path === 'source.txt'));
    assert.notEqual(v.outcome, 'no_changes');
  }

  /** Verifies that frozen test restoration refuses aredirected file without overwriting its target. */
  async frozenTestRestorationRefusesARedirectedFileWithoutOverwritingItsTarget(t: TestContext) {
    const { withFrozenTests } = await import('../../../../dist/library/assignment/checkpoints.js');
    const { digest } = await import('../../../../dist/library/architecture/assignment.js');
    const { writeFileSync, unlinkSync, symlinkSync } = await import('node:fs');
    const f = workflowFixture(t),
      path = join(f.repo, 'tests/frozen.cjs'),
      precious = join(f.root, 'precious');
    writeFileSync(path, 'original');
    writeFileSync(precious, 'keep');
    const record = { workspace: f.repo, base: f.git('rev-parse', 'HEAD') } as any;
    const bytes = Buffer.from('frozen');
    await assert.rejects(
      withFrozenTests(
        record,
        [{ path: 'tests/frozen.cjs', content: bytes.toString('base64'), sha256: digest(bytes) }],
        async () => {
          unlinkSync(path);
          symlinkSync(precious, path);
        },
      ),
      /Symlink/,
    );
    assert.equal(readFileSync(precious, 'utf8'), 'keep');
  }

  /** Verifies that candidate guidance cannot authorize edits outside captured scope. */
  candidateGuidanceCannotAuthorizeEditsOutsideCapturedScope(t: TestContext) {
    const f = workflowFixture(t);
    f.component.owns.push('AGENTS.md');
    writeFileSync(join(f.repo, 'architecture/components/sample.json'), JSON.stringify(f.component));
    f.commit();
    f.configure({ guidanceExpansion: true });
    const r = f.run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /scope/i);
  }
}

const suite = new WorkflowTests();

test('built CLI performs planned checked turns on one thread', (t: any) =>
  suite.builtCLIPerformsPlannedCheckedTurnsOnOneThread(t));

for (const kind of ['research', 'review'])
  test(`${kind} succeeds without edits`, (t: any) => suite.completesReadOnlyAssignment(t, kind));

for (const mode of [
  'early-implementation',
  'wrong-red',
  'scope',
  'ignored',
  'commit',
  'symlink',
  'staged-scope',
  'masked-symlink',
  'review-write',
  'malformed',
])
  test(`host rejects ${mode}`, (t: any) => suite.rejectsInvalidWorkflowResult(t, mode));

test('automatic repair preserves frozen tests and cumulative usage', (t: any) =>
  suite.automaticRepairPreservesFrozenTestsAndCumulativeUsage(t));

test('review can request correction without an attempt allowance', (t: any) =>
  suite.reviewCanRequestCorrectionWithoutAnAttemptAllowance(t));

test('a weakened current test cannot replace frozen acceptance', (t: any) =>
  suite.aWeakenedCurrentTestCannotReplaceFrozenAcceptance(t));

test('owner request yields a safe waiting checkpoint', (t: any) =>
  suite.ownerRequestYieldsSafeWaitingCheckpoint(t));

test('unknown owner request yields for scheduler authority resolution', (t: any) =>
  suite.ownerRequestYieldsSafeWaitingCheckpoint(t, 'unknown-owner'));

test('unchanged change assignment is explicitly no_changes', (t: any) =>
  suite.unchangedChangeAssignmentIsExplicitlyNoChanges(t));

for (const mode of ['rename', 'index-only'])
  test(`Git evidence preserves ${mode}`, (t: any) => suite.preservesGitChangeEvidence(t, mode));

test('frozen-test restoration refuses a redirected file without overwriting its target', (t: any) =>
  suite.frozenTestRestorationRefusesARedirectedFileWithoutOverwritingItsTarget(t));

test('candidate guidance cannot authorize edits outside captured scope', (t: any) =>
  suite.candidateGuidanceCannotAuthorizeEditsOutsideCapturedScope(t));

test('late host diagnostics reach the corrective steward', (t) =>
  suite.lateFailureReachesCorrection(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
