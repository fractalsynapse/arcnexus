import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { ResourceQuery } from '../../../../dist/library/report/resource-query.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Checks task controls against durable production host state and captured authority. */
class TaskControlScenarios {
  /** Paused tasks release dispatch, retain assignments and cannot revive after cancellation. */
  lifecycle(t: TestContext): void {
    const host = this.host(t);
    const run = host.submit('Retain bounded research');
    const assignment = host.store.enqueue(run.id, 'c', 'Research', ['Evidence']);
    host.taskControl('pause', run.id);
    assert.equal(host.store.run(run.id).status, 'paused');
    host.taskControl('pause', run.id);
    host.taskControl('resume', run.id);
    assert.equal(host.store.run(run.id).status, 'running');
    assert.deepEqual(host.store.assignment(assignment.id), assignment);
    host.taskControl('pause', run.id);
    host.taskControl('stop', run.id);
    host.taskControl('stop', run.id);
    assert.equal(host.store.run(run.id).status, 'cancelled');
    assert.throws(() => host.taskControl('resume', run.id), /cannot resume/i);
  }

  /** Answers require a retained question and optimistic mutations reject stale resource reads. */
  answers(t: TestContext): void {
    const host = this.host(t);
    const run = host.submit('Clarify acceptance');
    assert.throws(() => host.taskControl('answer', run.id, 'Response'), /awaiting input/);
    host.store.updateRun(run.id, 'needs_input', { questions: ['Which contract?'] });
    assert.throws(() => host.taskControl('answer', run.id, ' '), /empty/);
    const revision = new ResourceQuery().revision(host.reports.view(run.id));
    host.taskControl('answer', run.id, 'Use the public contract', revision);
    assert.equal(host.store.run(run.id).status, 'running');
    assert.match(String(host.store.run(run.id).data.prompt), /Use the public contract/);
    assert.throws(() => host.taskControl('pause', run.id, undefined, revision), /Stale/);
    assert.equal(host.store.run(run.id).status, 'running');
  }

  /** Paused feedback preserves retained work and only schedules direction after explicit resume. */
  feedback(t: TestContext): void {
    const host = this.host(t);
    const run = host.submit('Repair the original defect');
    const assignment = host.store.enqueue(run.id, 'c', 'Repair', ['Regression']);
    host.store.updateRun(run.id, 'running', { initialized: true });
    host.taskControl('pause', run.id);
    const before = host.store.run(run.id);
    const revision = new ResourceQuery().revision(host.reports.view(run.id));
    host.taskControl('answer', run.id, 'Review found a false passing check', revision);
    const retained = host.store.run(run.id);
    assert.equal(retained.status, 'paused');
    assert.equal(retained.data.initialized, false);
    assert.equal(retained.objective, before.objective);
    assert.equal(retained.data.authorityBase, before.data.authorityBase);
    assert.equal(retained.data.candidateRevision, before.data.candidateRevision);
    assert.match(String(retained.data.prompt), /Repair the original defect.*\nArchitect response:/);
    assert.deepEqual(host.store.assignment(assignment.id), assignment);
    assert.throws(() => host.taskControl('answer', run.id, 'Duplicate', revision), /Stale/);
    host.taskControl('resume', run.id);
    assert.equal(host.store.run(run.id).data.initialized, false);
    for (const status of ['pausing', 'completed', 'cancelled'] as const) {
      host.store.updateRun(run.id, status);
      assert.throws(() => host.taskControl('answer', run.id, 'Response'), /safely paused/);
    }
  }

  /** Interrupted operations cannot be replayed by a resume request. */
  uncertain(t: TestContext): void {
    const host = this.host(t);
    const run = host.submit('Inspect uncertain work');
    host.store.updateRun(run.id, 'interrupted', { uncertainPolicyRecords: ['uncertain'] });
    assert.throws(() => host.taskControl('resume', run.id), /uncertain/);
    assert.equal(host.store.run(run.id).status, 'needs_attention');
    assert.throws(() => host.taskControl('resume', run.id), /uncertain/);
    assert.equal(host.store.run(run.id).status, 'needs_attention');
    host.taskControl('stop', run.id);
    assert.equal(host.store.run(run.id).status, 'cancelled');
  }

  /** Captures the real fixture architecture without dispatching a model activation. */
  private host(t: TestContext): ProjectHost {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    return host;
  }
}

const scenarios = new TaskControlScenarios();

test('task pause resume and stop preserve assignments and terminality', (t) =>
  scenarios.lifecycle(t));

test('task answers and revision checks reject invalid mutations', (t) => scenarios.answers(t));

test('paused task feedback retains work and requires explicit resume', (t) =>
  scenarios.feedback(t));

test('task resume retains uncertain-operation blockers', (t) => scenarios.uncertain(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
