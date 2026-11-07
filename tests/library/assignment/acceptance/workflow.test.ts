import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { validateCheckpoint } from '../../../../dist/library/assignment/steward.js';
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
    assert.equal(v.outcome, 'prepared_for_assembly');
    assert.deepEqual(
      v.turns.map((x: any) => x.activity),
      ['planning', 'specification', 'implementation'],
    );
    assert.equal(v.implementationAttempts, 1);
    assert.equal(v.usage.input_tokens, 30);
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
      r = f.run(...(mode === 'review-write' ? ['--kind', 'review'] : []));
    assert.equal(r.status, 1, r.stderr);
    assert.notEqual(JSON.parse(r.stdout).status, 'completed');
  }

  /** Preparation does not run a final check even when that check would emit a late failure. */
  defersFinalFailure(t: TestContext): void {
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
    assert.ok(!calls.some((call) => call.stage === 'correction'));
    const record = JSON.parse(result.stdout);
    assert.equal(record.correctiveFeedback, undefined);
    assert.ok(!record.commands.some((command: any) => command.stage === 'verification'));
    assert.equal(record.status, 'prepared');
  }

  /** Keeps expected-red evidence and usage without claiming final acceptance. */
  retainsPreparedFailure(t: TestContext): void {
    const f = workflowFixture(t, 'repair');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.status, 'prepared');
    assert.equal(record.implementationAttempts, 1);
    assert.equal(record.usage.input_tokens, 30);
    assert.ok(record.commands.some((command: any) => command.exitCode !== 0));
    assert.equal(record.correctiveFeedback, undefined);
    assert.equal(record.plan.hostChecks[0].status, 'pending');
    assert.ok(record.frozenTests.length);
  }

  /** Missing correction findings and genuine blockers cannot be accepted as corrective review. */
  rejectsNoncorrectiveReview(t: TestContext, blocked: boolean): void {
    const f = workflowFixture(t, blocked ? 'review-repair' : 'review-failure');
    if (blocked) f.configure({ reviewStatus: 'blocked' });
    const result = f.run('--kind', 'review');
    assert.equal(result.status, 1, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.agent.status, blocked ? 'blocked' : 'failed');
    assert.match(record.error, new RegExp(`Agent reported ${record.agent.status}`));
    assert.notEqual(record.status, 'completed');
    assert.equal(record.turns.length, 2);
  }

  /** Prepared test edits retain original acceptance inputs and cannot claim verified delivery. */
  preparedEditsRetainFrozenAcceptance(t: TestContext) {
    const f = workflowFixture(t, 'weak-test');
    const r = f.run();
    assert.equal(r.status, 0);
    const record = JSON.parse(r.stdout);
    assert.equal(record.outcome, 'prepared_for_assembly');
    assert.equal(record.plan.hostChecks[0].status, 'pending');
    assert.equal(
      readFileSync(join(record.workspace, 'tests/regression.cjs'), 'utf8'),
      '// weakened test',
    );
    assert.ok(record.commands.some((command: any) => command.exitCode === 1));
    assert.ok(record.frozenTests.length);
  }

  /** A corrected incidental assertion preserves red evidence without forcing incorrect product behavior. */
  correctedRegressionRetainsEvidence(t: TestContext): void {
    const f = workflowFixture(t, 'corrected-regression');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'prepared_for_assembly');
    const original = record.frozenTests.find((test: any) => test.path === 'tests/regression.cjs');
    assert.match(Buffer.from(original.content, 'base64').toString(), /INCIDENTAL_MISTAKE/);
    const current = readFileSync(join(record.workspace, original.path), 'utf8');
    assert.doesNotMatch(current, /INCIDENTAL_MISTAKE/);
    assert.match(current, /BOUNDARY_EXPECTED/);
    assert.ok(
      record.commands.some(
        (command: any) => command.stage === 'red-test' && command.exitCode === 1,
      ),
    );
    assert.ok(!record.commands.some((command: any) => command.stage === 'frozen-regression'));
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
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

  /** A failed completed response retains a verifiable boundary but never becomes a successful delivery. */
  reportedFailureCheckpoint(t: TestContext): void {
    const f = workflowFixture(t, 'reported-failure');
    const result = f.run();
    assert.equal(result.status, 1);
    const record = JSON.parse(result.stdout);
    assert.equal(record.status, 'failed');
    assert.equal(record.outcome, 'failed');
    assert.equal(record.safeCheckpoint, true);
    assert.match(record.error, /Agent reported failed/);
    validateCheckpoint(f.state, record);
    assert.throws(
      () =>
        validateCheckpoint(f.state, {
          ...record,
          operationInvocations: [{ status: 'interrupted' }],
        }),
      /Operation completion is uncertain/,
    );
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
    assert.equal(r.status, 0);
    const v = JSON.parse(r.stdout);
    assert.equal(v.status, 'prepared');
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

test('prepared failures preserve regression evidence and usage for assembled correction', (t) =>
  suite.retainsPreparedFailure(t));

for (const blocked of [false, true])
  test(`review ${blocked ? 'blockers' : 'failure without findings'} prevents completion`, (t) =>
    suite.rejectsNoncorrectiveReview(t, blocked));

test('prepared test edits retain captured acceptance without claiming delivery', (t: any) =>
  suite.preparedEditsRetainFrozenAcceptance(t));

test('owner request yields a safe waiting checkpoint', (t: any) =>
  suite.ownerRequestYieldsSafeWaitingCheckpoint(t));

test('unknown owner request yields for scheduler authority resolution', (t: any) =>
  suite.ownerRequestYieldsSafeWaitingCheckpoint(t, 'unknown-owner'));

test('completed worker failure retains a safe diagnostic checkpoint without accepting uncertainty', (t) =>
  suite.reportedFailureCheckpoint(t));

test('unchanged change assignment is explicitly no_changes', (t: any) =>
  suite.unchangedChangeAssignmentIsExplicitlyNoChanges(t));

for (const mode of ['rename', 'index-only'])
  test(`Git evidence preserves ${mode}`, (t: any) => suite.preservesGitChangeEvidence(t, mode));

test('frozen-test restoration refuses a redirected file without overwriting its target', (t: any) =>
  suite.frozenTestRestorationRefusesARedirectedFileWithoutOverwritingItsTarget(t));

test('candidate guidance cannot authorize edits outside captured scope', (t: any) =>
  suite.candidateGuidanceCannotAuthorizeEditsOutsideCapturedScope(t));

test('corrected worker regression retains original failure evidence', (t) =>
  suite.correctedRegressionRetainsEvidence(t));

test('final host checks are deferred to assembled correction', (t) => suite.defersFinalFailure(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
