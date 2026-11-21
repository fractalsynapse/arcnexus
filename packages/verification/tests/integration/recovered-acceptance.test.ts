import assert from 'node:assert/strict';
import test from 'node:test';
import type { Plan } from '../../../direction/src/index.js';
import { checkInput } from '../../../execution/src/check-cache.js';
import type { Candidate } from '../../src/index.js';
import { originalRequirement } from '../fixtures/recovered-project.js';
import { RecoveredAssessment, type CheckState } from '../fixtures/recovered-assessment.js';

export const suite = { owner: 'verification', level: 'integration', tags: ['regression'] } as const;

for (const identity of ['tree', 'base', 'capture', 'acceptance'] as const) {
  test('earlier verdict cannot authorize recovered ' + identity + ' identity', async (context) => {
    const fixture = new RecoveredAssessment(context);
    const originalCandidate = await fixture.assemble();
    const verdict = await fixture.run(originalCandidate);
    assert.equal(verdict.kind, 'accepted');
    fixture.task.note({ candidate: originalCandidate, verdict });
    const historical = structuredClone(fixture.task.observations());
    const head = identity === 'tree' ? fixture.changeCandidate() : fixture.checkpoint;
    const current = fixture.advance(identity === 'capture' ? 'capture' : 'base');
    fixture.resume(
      identity === 'base' ? current : fixture.original,
      identity === 'capture' ? current : fixture.original,
      head,
    );
    if (identity === 'acceptance') fixture.plan = additionalObligation(fixture.plan);
    const recovered = await fixture.assemble();
    assert.equal(recovered.digest === originalCandidate.digest, identity !== 'tree');
    assert.deepEqual(fixture.task.observations().slice(0, historical.length), historical);
    await fixture.refuseReplay(verdict);
  });
}

test('new assessment exposes recovered base and active capture independently of equal tree bytes', async (context) => {
  const fixture = new RecoveredAssessment(context);
  const before = await fixture.assemble();
  const base = fixture.advance('base');
  const current = fixture.advance('capture');
  fixture.resume(base, current);
  const recovered = await fixture.assemble();
  assert.equal(recovered.digest, before.digest);
  const verdict = await fixture.run(recovered);
  assert.equal(verdict.kind, 'accepted');
  assert(verdict.kind === 'accepted');
  const observation = fixture.task
    .observations<{ verification?: { identity: unknown; checks: unknown } }>()
    .findLast(({ verification }) => verification)?.verification;
  assert(observation);
  assert.deepEqual(observation.identity, verdict.verification);
  assert.deepEqual(observation.checks, fixture.checks);
  assert.equal(verdict.verification?.tree, recovered.digest);
  assert.equal(verdict.verification?.base, base.source.revision);
  assert.equal(verdict.verification?.capture, current.source.revision);
  const assignment = JSON.stringify(fixture.requests.at(-1)!.assignment);
  assert(assignment.includes(recovered.digest), 'Assessment must identify the assembled tree');
  assert(assignment.includes(base.source.revision), 'Assessment lost recovered staging parent');
  assert(
    assignment.includes(current.source.revision),
    'Assessment lost recovered staging/capture identity',
  );
  fixture.assertHistory();
});

test('a different checkout path preserves the candidate and complete evidence for a fresh assessment', async (context) => {
  const fixture = new RecoveredAssessment(context);
  const original = await fixture.assemble();
  await fixture.run(original);
  const oldPath = fixture.task.worktree;
  fixture.resume();
  const recovered = await fixture.assemble();
  const verdict = await fixture.run(recovered);
  assert.notEqual(fixture.task.worktree, oldPath);
  assert.equal(recovered.digest, original.digest);
  assert.equal(verdict.kind, 'accepted');
  if (verdict.kind === 'accepted') assert.equal(verdict.candidate, recovered.digest);
  fixture.assertHistory();
});

for (const change of ['mapping', 'required'] as const) {
  test('recovered assessment executes current ' + change + ' before review', async (context) => {
    const fixture = new RecoveredAssessment(context);
    await fixture.interrupt();
    const oldLog = fixture.checks[0]!.log;
    const current = fixture.advance(change);
    fixture.resume(current, current);
    assert.equal((await fixture.run()).kind, 'accepted');
    const request = fixture.requests.at(-1)!;
    const assignment = request.assignment as { checks: typeof fixture.checks };
    assert.deepEqual(
      assignment.checks.map(({ id }) => id),
      current.project.checks!.acceptance,
    );
    const required = assignment.checks.find(({ id }) => id === 'required')!;
    assert.deepEqual(required.args, ['%s', change === 'mapping' ? 'current-tag' : 'original-tag']);
    assert.equal(required.cwd, fixture.task.worktree);
    assert.notEqual(required.log, oldLog);
    assert.match(
      fixture.task.readFile(required.log).text,
      change === 'mapping' ? /current-tag/ : /original-tag/,
    );
    if (change === 'required') {
      const added = assignment.checks.find(({ id }) => id === 'newly-required')!;
      assert.deepEqual(added.args, ['%s', 'new-tag']);
      assert.equal(added.status, 0);
    }
    fixture.assertHistory(request);
  });
}

test('incomplete retained checklist cannot silently omit newly required evidence', async (context) => {
  const fixture = new RecoveredAssessment(context);
  const current = fixture.advance('required');
  fixture.resume(current, current);
  const candidate = await fixture.assemble();
  fixture.task.note({
    researchingVerification: {
      candidate: candidate.digest,
      ownerEvidenceDigest: candidate.ownerEvidenceDigest,
      revision: current.source.revision,
      checks: [],
    },
  });
  const result = await fixture.run(candidate);
  const checked = fixture.requests.at(-1)?.assignment as
    { checks?: typeof fixture.checks } | undefined;
  assert(
    result.kind !== 'accepted' ||
      checked?.checks?.some(({ id, status }) => id === 'newly-required' && status === 0),
    'An empty retained checklist bypassed the required recovered check',
  );
});

for (const [name, state] of [
  ['failed', { status: 1 }],
  ['unavailable', { status: null }],
  ['skipped', { status: 'not-applicable' }],
  ['scope-invalid', { status: 0, diagnostic: 'Explicit recovered selection matched no cases' }],
] satisfies Array<[string, CheckState]>) {
  test(
    name + ' required recovered evidence prevents acceptance with its exact log retained',
    async (context) => {
      const fixture = new RecoveredAssessment(context);
      await fixture.interrupt();
      const current = fixture.advance('required');
      fixture.resume(current, current);
      fixture.checkState = state;
      const reviews = fixture.requests.length;
      const result = await fixture.run();
      assert.equal(result.kind, 'blocked');
      assert.equal(fixture.requests.length, reviews + (typeof state.status === 'number' ? 1 : 0));
      assert(result.evidence.length);
      assert(result.evidence.every((path) => fixture.task.evidence.includes(path)));
      const observed = fixture.checks.at(-1)!;
      assert.equal(observed.status, state.status);
      assert.equal(observed.diagnostic, state.diagnostic);
      assert.match(fixture.task.readFile(observed.log).text, /Controlled check:/);
    },
  );
}

test('unchanged interrupted assessment reuses exact complete check observations and preserves all historical sources', async (context) => {
  const fixture = new RecoveredAssessment(context);
  await fixture.interrupt();
  const originalChecks = structuredClone(fixture.checks);
  const originalCandidate: Candidate = await fixture.assemble();
  fixture.resume();
  const candidate = await fixture.assemble();
  assert.equal(candidate.digest, originalCandidate.digest);
  assert.equal((await fixture.run(candidate)).kind, 'accepted');
  const request = fixture.requests.at(-1)!;
  assert.deepEqual((request.assignment as { checks: unknown }).checks, originalChecks);
  assert.deepEqual(fixture.checks, originalChecks);
  fixture.assertHistory(request);
});

/** Model an approved additional obligation while retaining the original criterion identity and promise. */
function additionalObligation(plan: Plan): Plan {
  return {
    ...plan,
    milestones: plan.milestones.map((milestone) => ({
      ...milestone,
      criteria: [
        {
          id: 'continuity',
          description: originalRequirement + '; also retain new approved obligation',
        },
      ],
    })),
  };
}

test('a changed dependency environment invalidates interrupted check evidence on the same tree and capture', async (context) => {
  const fixture = new RecoveredAssessment(context);
  await fixture.interrupt();
  const old = fixture.checks[0]!;
  const candidate = await fixture.assemble();
  const capture = fixture.task.capture.source.revision;
  const input = checkInput(fixture.task, 'required');
  assert(input);
  fixture.changeEnvironment();
  fixture.resume();
  assert.notEqual(checkInput(fixture.task, 'required'), input);
  assert.equal(fixture.task.capture.source.revision, capture);
  assert.equal((await fixture.assemble()).digest, candidate.digest);
  assert.equal((await fixture.run()).kind, 'accepted');
  const request = fixture.requests.at(-1)!;
  const current = (request.assignment as { checks: typeof fixture.checks }).checks;
  assert.notEqual(
    current[0]!.log,
    old.log,
    'Changed dependencies reused an earlier environment observation',
  );
  assert.equal(current[0]!.status, 0);
  assert.notEqual(fixture.task.readFile(current[0]!.log).text, fixture.task.readFile(old.log).text);
});
