import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AgentActivityHold } from '../../../agent/src/index.js';
import type { Verdict } from '../../../verification/src/index.js';
import { BindingScenario, identity, plan, type Assignment } from './binding-fixture.js';

export const suite = { owner: 'reviewer', level: 'integration', tags: ['regression'] } as const;

// Real caller: Verification supplies this binding. A template missing even one field must fail.
for (const kind of ['accepted', 'rejected'] as const) {
  test(`assess exposes unchanged verification in the assignment and ${kind} template`, async (t) => {
    const fixture = new BindingScenario(t);
    const verdict = await fixture.run((assignment) => {
      assert.deepEqual(assignment.verification, identity);
      assert.deepEqual(assignment.accepted.verification, identity);
      assert.deepEqual(assignment.rejected.verification, identity);
      return kind === 'accepted'
        ? { ...assignment.accepted, criteria: ['binding'], evidence: [fixture.evidence] }
        : { ...assignment.rejected, findings: rejection(fixture).findings };
    });
    assert.deepEqual(verdict, fixture.verdict(kind));
    assert.equal(fixture.requests.length, 1);
  });

  test(`assess accepts an explicit host-bound ${kind} response`, async (t) => {
    const fixture = new BindingScenario(t);
    assert.deepEqual(await fixture.run(() => fixture.verdict(kind)), fixture.verdict(kind));
  });
}

function rejection(fixture: BindingScenario) {
  return fixture.verdict('rejected') as Extract<Verdict, { kind: 'rejected' }>;
}

// Each stale dimension leaves the tree unchanged where possible, defeating tree-only validation.
for (const field of ['tree', 'base', 'capture', 'acceptance', 'inputs'] as const) {
  test(`assess returns stale ${field} to the same caller without rebinding its verdict`, async (t) => {
    const fixture = new BindingScenario(t);
    const stale = { ...identity, [field]: `earlier-${field}` };
    const result = await fixture.run((_assignment, visit) =>
      fixture.verdict('accepted', visit === 1 ? stale : identity));
    assert.deepEqual(result, fixture.verdict('accepted'));
    assert.equal(fixture.requests.length, 2);
    assertRepairInputs(fixture);
    assert.match(assignment(fixture, 1).diagnostic!, /different verification identity/);
    assert.deepEqual(readJson(fixture.artifacts[1]!).verification, stale);
  });
}

test('assess repairs a missing binding instead of silently attaching the current identity', async (t) => {
  const fixture = new BindingScenario(t);
  const result = await fixture.run((_assignment, visit) => {
    const reply = fixture.verdict('rejected');
    if (visit === 1 && reply.kind === 'rejected') delete reply.verification;
    return reply;
  });
  assert.deepEqual(result, fixture.verdict('rejected'));
  assert.equal(fixture.requests.length, 2);
  assertRepairInputs(fixture);
  assert.equal(readJson(fixture.artifacts[1]!).verification, undefined);
});

test('unchanged stale or missing responses retain a hold with complete failed observations', async (t) => {
  for (const missing of [false, true]) {
    const fixture = new BindingScenario(t);
    await assert.rejects(fixture.run(() => {
      const reply = rejection(fixture);
      reply.verification = missing ? undefined : { ...identity, capture: 'old-capture' };
      return reply;
    }), /Reviewer repeated an unchanged finding:.*different verification identity/);
    assert.equal(fixture.requests.length, 2);
    assert.equal(fixture.artifacts.length, 6);
    assert(fixture.artifacts.every((path) => fixture.task.evidence.includes(path)));
    assertRepairInputs(fixture);
  }
});

test('an unbound caller receives no fabricated verification assignment or templates', async (t) => {
  const fixture = new BindingScenario(t, false);
  const result = await fixture.run((input) => {
    assert.equal(input.verification, undefined);
    assert.equal(input.accepted.verification, undefined);
    assert.equal(input.rejected.verification, undefined);
    const reply = fixture.verdict('accepted');
    if (reply.kind === 'accepted') delete reply.verification;
    return reply;
  });
  assert.equal(result.kind === 'accepted' && result.verification, undefined);
});

for (const kind of ['accepted', 'rejected'] as const) {
  test(`citation-only repair retains the full ${kind} determination and complete history`, async (t) => {
    const fixture = new BindingScenario(t);
    const report = fixture.task.store('original-report.txt', 'Original report\nDistinct finding before recovery.\n');
    const answer = fixture.task.store('human-answer.txt', 'Preserve the original issue.\n  Keep this exact condition.\n');
    const result = await fixture.run((_input, visit) => {
      const reply = fixture.verdict(kind);
      return visit === 1 ? invalidCitation(reply) : reply;
    });
    assert.deepEqual(result, fixture.verdict(kind));
    assert.equal(fixture.requests.length, 2);
    const repair = assignment(fixture, 1).citationRepair!;
    assert.deepEqual(repair.verdict, invalidCitation(fixture.verdict(kind)));
    assert.match(repair.diagnostic, /not-retained.log.*outside the retained evidence list/);
    assert.deepEqual(assignment(fixture, 1).checks, fixture.checks);
    assert.deepEqual(fixture.requests[1]!.acceptance, fixture.requests[0]!.acceptance);
    assertHistory(fixture, [report, answer]);
    assert.equal(readFileSync(answer, 'utf8'), 'Preserve the original issue.\n  Keep this exact condition.\n');
    assert.equal(readFileSync(report, 'utf8'), 'Original report\nDistinct finding before recovery.\n');
  });

  test(`citation repair cannot change a submitted ${kind} binding even for an unbound caller`, async (t) => {
    const fixture = new BindingScenario(t, false);
    const result = await fixture.run((_input, visit) => {
      const binding = visit === 2 ? { ...identity, inputs: 'substituted-checks' } : identity;
      const reply = fixture.verdict(kind, binding);
      return visit === 1 ? invalidCitation(reply) : reply;
    });
    assert.deepEqual(result, fixture.verdict(kind));
    assert.equal(fixture.requests.length, 3);
    assert.match(assignment(fixture, 2).citationRepair!.diagnostic, /changed the assessment/);
    assert.deepEqual(assignment(fixture, 2).citationRepair!.verdict, invalidCitation(fixture.verdict(kind)));
  });
}

test('citation repair refuses repeated changed bindings rather than accepting a fresh identity', async (t) => {
  const fixture = new BindingScenario(t, false);
  await assert.rejects(fixture.run((_input, visit) => visit === 1
    ? invalidCitation(fixture.verdict('accepted'))
    : fixture.verdict('accepted', { ...identity, base: 'other-parent' })), AgentActivityHold);
  assert.equal(fixture.requests.length, 3);
});

function assignment(fixture: BindingScenario, index: number) {
  return fixture.requests[index]!.assignment as Assignment;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Check payload values rather than call counts alone: response repair cannot replace inputs. */
function assertRepairInputs(fixture: BindingScenario) {
  const { diagnostic: _diagnostic, ...resumed } = assignment(fixture, 1);
  assert.deepEqual(resumed, assignment(fixture, 0));
  assert.deepEqual(fixture.requests[1]!.acceptance, fixture.requests[0]!.acceptance);
  assert.deepEqual(fixture.requests[1]!.milestone, plan.milestones);
  assert.deepEqual(assignment(fixture, 1).checks, fixture.checks);
  assert.deepEqual(fixture.candidate.verification, identity);
}

/** Replace citations alone, preserving every engineering field including verification identity. */
function invalidCitation(reply: Verdict): Verdict {
  return reply.kind === 'accepted' ? { ...reply, evidence: ['not-retained.log'] }
    : reply.kind === 'rejected' ? {
      ...reply, findings: reply.findings.map((finding) => ({ ...finding, evidence: ['not-retained.log'] })),
    } : reply;
}

/** Read canonical artifacts and journal records, without recursively embedding prior transcripts. */
function assertHistory(fixture: BindingScenario, original: string[]) {
  const index = (fixture.requests[1]!.evidence as string[]).find((path) => path.includes('-retained-evidence-'));
  assert(index);
  const references: string[] = readJson(index).references;
  assert([...original, ...fixture.artifacts.slice(0, 3)].every((path) => references.includes(path)));
  const events = fixture.task.observations<{ controlledAttempt?: unknown }>();
  assert.equal(events.filter((event) => event.controlledAttempt).length, 2);
  for (const visit of [1, 2]) {
    const offset = (visit - 1) * 3;
    assert.deepEqual(readJson(fixture.artifacts[offset]!), fixture.requests[visit - 1]);
    assert.deepEqual(readJson(fixture.artifacts[offset + 2]!), {
      profile: 'reviewer-assessment', visit, usage: { input: visit * 13, output: visit * 7 },
      provider: 'controlled-fixture',
    });
  }
}
