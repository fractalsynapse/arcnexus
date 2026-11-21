import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { RecoveredAssessment } from '../fixtures/recovered-assessment.js';

export const suite = { owner: 'verification', level: 'integration', tags: ['regression'] } as const;

test('ordinary failed recovered checks reach independent rejection with exact evidence', async (context) => {
  const fixture = new RecoveredAssessment(context);
  await fixture.interrupt();
  const historical = structuredClone(fixture.checks);
  const current = fixture.advance('required');
  fixture.resume(current, current);
  fixture.checkState = { status: 1 };
  const candidate = await fixture.assemble();
  const reviewer = rejectFailedChecks(context, fixture);
  const result = await fixture.run(candidate);
  assert.equal(result.kind, 'rejected', JSON.stringify(result));
  assert(result.kind === 'rejected');
  assert.equal(reviewer.mock.calls.length, 1);
  assert.deepEqual(result, await reviewer.mock.calls[0]!.result);
  assert.equal(result.candidate, candidate.digest);
  assert.equal(result.verification?.base, current.source.revision);
  assert.equal(result.verification?.capture, current.source.revision);
  assert.deepEqual(fixture.checks.slice(0, historical.length), historical);
  const expected = fixture.checks.slice(historical.length);
  assert.deepEqual(
    expected.map(({ id }) => id),
    current.project.checks!.acceptance,
  );
  assert(expected.every(({ status }) => status === 1));
  assert.deepEqual(
    result.findings[0]!.evidence,
    expected.map(({ log }) => log),
  );
});

/** Require the actual failed payload and readable history before issuing a bound substantive rejection. */
function rejectFailedChecks(context: TestContext, fixture: RecoveredAssessment) {
  return context.mock.method(
    fixture.task,
    'activate',
    async (...[, selection, data]: Parameters<RecoveredAssessment['task']['activate']>) => {
      assert.deepEqual(selection, fixture.task.capture.project.verifier);
      const assignment = data.assignment as {
        checks: typeof fixture.checks;
        rejected: Record<string, unknown>;
      };
      const checks = assertFailedEvidence(fixture, assignment.checks);
      fixture.assertHistory(data);
      return {
        ...assignment.rejected,
        findings: [
          {
            criterion: fixture.plan.milestones[0]!.criteria[0]!.id,
            owner: fixture.plan.milestones[0]!.owner,
            reason: 'Current recovered required assertions failed',
            evidence: checks.map(({ log }) => log),
          },
        ],
      };
    },
  );
}

/** Compare the full current check payload with retained readable observations rather than status alone. */
function assertFailedEvidence(fixture: RecoveredAssessment, supplied: typeof fixture.checks) {
  const checks = fixture.checks.filter(({ status }) => status === 1);
  assert.deepEqual(supplied, checks);
  assert.deepEqual(
    checks.map(({ id }) => id),
    ['required', 'newly-required'],
  );
  for (const check of checks) {
    assert.equal(check.cwd, fixture.task.worktree);
    assert(fixture.task.evidence.includes(check.log));
    const log = fixture.task.readFile(check.log).text;
    assert(log.startsWith('Controlled check: '));
    const observation = JSON.parse(log.slice('Controlled check: '.length));
    assert.deepEqual(observation.result, { status: 1 });
    assert.deepEqual(observation.operation.args, check.args);
  }
  return checks;
}
