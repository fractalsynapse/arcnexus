import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AssignmentDispatch } from '../../../../dist/library/execution-runtime/assignment-dispatch.js';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Requires the director to address uncovered goal criteria without discarding verified owner work. */
class DirectorRecoveryScenarios {
  /** A failed final assessment creates additional bounded work and reassesses the original goal. */
  async coverage(t: TestContext): Promise<void> {
    const host = this.host(t);
    const task = host.submit('REPLAN_GOAL: research evidence with full goal coverage');
    for (let observation = 0; observation < 30; observation++) {
      await host.tick();
      if (host.store.run(task.id).status !== 'running') break;
    }
    const run = host.store.run(task.id);
    assert.equal(run.status, 'completed', JSON.stringify(run.data.error));
    const assignments = host.store.assignments(task.id);
    assert.equal(assignments.length, 4);
    assert.equal(assignments.filter((a) => a.owner === 'c').length, 2);
    assert.ok(assignments.every((a) => a.status === 'completed'));
    assert.ok(Array.isArray(run.data.directionHistory));
    assert.ok(run.data.goalEvidence);
    assert.equal(run.objective, task.objective);
  }

  /** Blocked work receives director diagnosis and a substantive question without fabricated delivery. */
  async diagnosis(t: TestContext): Promise<void> {
    const host = this.host(t);
    const task = host.submit('Diagnose unresolved authority');
    host.store.updateRun(task.id, 'running', { initialized: true });
    const assignment = host.store.enqueue(task.id, 'a', 'Needs an architectural decision');
    host.store.fail(assignment.id, 'blocked', 'Unknown owner');
    await host.tick();
    const run = host.store.run(task.id);
    assert.equal(run.status, 'needs_input');
    assert.ok((run.data.questions as string[]).length > 0);
    assert.equal(host.store.assignment(assignment.id).status, 'blocked');
    assert.equal(host.store.assignments(task.id).length, 1);
  }

  /** A diagnosed supplier is replaced through real host direction without relaxing acceptance or claiming its failure passed. */
  async replacement(t: TestContext): Promise<void> {
    const host = this.host(t);
    const task = host.submit('REPLACE_WORKFLOW: characterize existing behavior');
    host.store.updateRun(task.id, 'running', { initialized: true });
    const old = host.store.enqueue(task.id, 'c', 'Characterize existing supplier', [
      'Existing result observed',
    ]);
    host.store.updateAssignment(old.id, 'ready', {
      proposal: { kind: 'change', changeType: 'behavior' },
    });
    host.store.fail(old.id, 'failed', 'Original workflow requires a fresh specification');
    await host.tick();
    const successor = host.store.effective(old.id);
    assert.notEqual(successor.id, old.id, JSON.stringify(host.store.run(task.id).data.error));
    assert.equal(successor.owner, old.owner);
    assert.equal(successor.data.replaces, old.id);
    assert.equal((successor.data.proposal as { changeType: string }).changeType, 'refactor');
    assert.deepEqual(successor.acceptance, old.acceptance);
    assert.equal(host.store.run(task.id).status, 'running');
    assert.equal(host.store.assignment(old.id).status, 'failed');
  }

  /** Admits a workday director successor without blocking unrelated ready stewardship work. */
  workdayReplacement(t: TestContext): void {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.store.close());
    host.control('start');
    const run = host.store.runs().find((item) => item.mode === 'workday')!;
    const old = host.store.enqueue(run.id, 'c', 'Characterize behavior', ['Observed']);
    const unrelated = host.store.enqueue(run.id, 'a', 'Unrelated ready work');
    host.store.updateAssignment(old.id, 'ready', {
      proposal: { kind: 'change', changeType: 'behavior' },
    });
    host.store.fail(old.id, 'failed', 'Requires a diagnosed fresh workflow');
    new AssignmentDispatch(f.state, context, host.store).apply(
      run,
      this.replacementDecision(old.id),
    );
    const successor = host.store.effective(old.id);
    assert.notEqual(successor.id, old.id);
    assert.equal(successor.owner, old.owner);
    assert.deepEqual(successor.acceptance, old.acceptance);
    assert.equal(host.store.assignment(old.id).status, 'failed');
    assert.ok(host.store.ready(run.id).some((item) => item.id === unrelated.id));
  }

  /** Ready work accepts feedback through the existing dispatcher without a duplicate assignment. */
  readyFeedback(t: TestContext): void {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.store.close());
    const run = host.submit('Correct the reviewed defect');
    const assignment = host.store.enqueue(run.id, 'c', 'Existing correction', [
      'Original criteria',
    ]);
    const decision = this.replacementDecision(assignment.id);
    const { replacementChangeType: _replacement, ...continuation } = decision.continuations[0]!;
    new AssignmentDispatch(f.state, context, host.store).apply(run, {
      ...decision,
      continuations: [{ ...continuation, reason: 'Correct the caller-reproduced false pass' }],
    });
    assert.equal(host.store.assignments(run.id).length, 1);
    const retained = host.store.assignment(assignment.id);
    assert.equal(retained.status, 'ready');
    assert.equal(retained.data.continuationReason, 'Correct the caller-reproduced false pass');
    assert.deepEqual(retained.acceptance, assignment.acceptance);
  }

  /** Refuses fresh engineering before dispatch when an old managed invocation may still have effects. */
  uncertain(t: TestContext, mode: 'task' | 'workday' = 'task'): void {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.store.close());
    const task = host.store.createRun(mode, context.owners, 'Recover uncertain work');
    const old = host.store.enqueue(task.id, 'c', 'Characterize behavior', ['Observed']);
    const path = join(f.state, 'runs', old.id);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, 'report.json'),
      JSON.stringify({ operationInvocations: [{ status: 'interrupted' }] }),
    );
    host.store.updateAssignment(old.id, 'failed', {
      recordId: old.id,
      proposal: { kind: 'change', changeType: 'behavior' },
    });
    assert.throws(
      () =>
        new AssignmentDispatch(f.state, context, host.store).apply(
          task,
          this.replacementDecision(old.id),
        ),
      /Operation completion is uncertain/,
    );
    assert.equal(host.store.assignments(task.id).length, 1);
  }

  /** Supplies a complete director decision at the model-result boundary. */
  private replacementDecision(id: string) {
    return {
      status: 'ready' as const,
      selectedOwners: [{ id: 'c', reason: 'Investigate' }],
      rejectedOwners: [],
      questions: [],
      architectureProposal: null,
      dependency: null,
      dependencyRetirementProposal: null,
      summary: 'Diagnose',
      assignments: [],
      continuations: [
        {
          assignmentId: id,
          ownerId: 'c',
          reason: 'Try a fresh workflow',
          replacementChangeType: 'refactor' as const,
        },
      ],
    };
  }

  /** Captures the ordinary package and uses production direction and assignment wiring. */
  private host(t: TestContext): ProjectHost {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    return host;
  }
}

const scenarios = new DirectorRecoveryScenarios();

test('director repairs missing goal coverage with additional verified assignments', (t) =>
  scenarios.coverage(t));

test('director diagnoses blocked work without claiming its delivery', (t) =>
  scenarios.diagnosis(t));

test('task direction replaces failed workflow while preserving original acceptance', (t) =>
  scenarios.replacement(t));

test('workday direction replaces failed change work without blocking unrelated ready work', (t) =>
  scenarios.workdayReplacement(t));

for (const mode of ['task', 'workday'] as const)
  test(`${mode} replacement refuses interrupted operations before fresh engineering`, (t) =>
    scenarios.uncertain(t, mode));

test('director feedback continues ready work without duplicate engineering', (t) =>
  scenarios.readyFeedback(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
