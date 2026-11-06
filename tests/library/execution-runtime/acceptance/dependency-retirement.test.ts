import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { AssignmentDispatch } from '../../../../dist/library/execution-runtime/assignment-dispatch.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import type { DirectorResult } from '../../../../dist/library/task-intake/direction.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Exercises ordinary host direction admission against real persisted request and checkpoint state. */
class DependencyRetirementScenarios {
  /** Retires an obsolete subtree without deleting its evidence, changing criteria or inventing completion. */
  recover(t: TestContext): void {
    const f = this.fixture(t);
    const nested = f.host.store.request(f.supplier.id, {
      key: 'nested',
      owner: 'c',
      objective: 'Conditional evidence',
      acceptance: ['Evidence'],
    });
    f.dispatch.apply(f.run, f.decision);
    const source = f.host.store.assignment(f.source.id);
    assert.equal(source.status, 'ready');
    assert.deepEqual(source.acceptance, f.source.acceptance);
    assert.deepEqual(source.dependencies, []);
    assert.deepEqual(
      f.host.store.requiredAssignments(f.run.id).map((item) => item.id),
      [source.id],
    );
    assert.deepEqual(
      f.host.store.ready(f.run.id).map((item) => item.id),
      [source.id],
    );
    assert.equal(f.host.store.assignment(nested.id).status, 'ready');
    assert.equal(f.host.store.assignment(f.supplier.id).status, 'waiting');
    assert.equal(f.host.store.assignments(f.run.id).length, 3);
    assert.equal(
      f.host.store.requestById(f.request.id).retirementRationale,
      'Obligation is obsolete',
    );
  }

  /** Makes current host request identities available to the director without reading worker prose. */
  context(t: TestContext): void {
    const f = this.fixture(t);
    const state = f.dispatch.state(f.run.id);
    assert.equal(state.find((item) => item.id === f.source.id)?.inbox[0]?.id, f.request.id);
    assert.equal(
      state.find((item) => item.id === f.source.id)?.inbox[0]?.assignmentId,
      f.supplier.id,
    );
    f.dispatch.apply(f.run, f.decision);
    assert.deepEqual(
      f.dispatch.state(f.run.id).map((item) => item.id),
      [f.source.id],
    );
  }

  /** Replaying an acknowledged host decision cannot rewind the assignment or retire its request twice. */
  replay(t: TestContext): void {
    const f = this.fixture(t);
    f.dispatch.apply(f.run, f.decision);
    f.host.store.complete(f.source.id, ['Observed verification']);
    const before = f.host.store.assignments(f.run.id);
    f.dispatch.apply(f.run, f.decision);
    assert.deepEqual(f.host.store.assignments(f.run.id), before);
  }

  /** Retires an unneeded wait directly without fabricating a failed assignment first. */
  waiting(t: TestContext): void {
    const f = this.fixture(t);
    f.host.store.updateAssignment(f.source.id, 'waiting');
    f.dispatch.apply(f.run, f.decision);
    assert.equal(f.host.store.assignment(f.source.id).status, 'ready');
    assert.deepEqual(f.host.store.assignment(f.source.id).dependencies, []);
  }

  /** Preserves a supplier and its nested work when an independent requester still requires them. */
  shared(t: TestContext): void {
    const f = this.fixture(t);
    const other = f.host.store.enqueue(f.run.id, 'c', 'Independent requirement');
    f.host.store.link(other.id, f.supplier.id);
    f.dispatch.apply(f.run, f.decision);
    const required = f.host.store.requiredAssignments(f.run.id).map((item) => item.id);
    assert.ok(required.includes(f.supplier.id));
    assert.ok(required.includes(other.id));
    assert.deepEqual(f.host.store.assignment(other.id).dependencies, [f.supplier.id]);
  }

  /** Rejects uncertain operation effects anywhere in the discarded subtree before admitting direction. */
  uncertain(t: TestContext): void {
    const f = this.fixture(t);
    const nested = f.host.store.request(f.supplier.id, {
      key: 'nested',
      owner: 'c',
      objective: 'Uncertain work',
      acceptance: ['Evidence'],
    });
    const directory = join(f.state, 'runs', nested.id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        operationInvocations: [{ status: 'interrupted' }],
      }),
    );
    f.host.store.updateAssignment(nested.id, 'failed', { recordId: nested.id });
    const before = f.host.store.assignments(f.run.id);
    assert.throws(() => f.dispatch.apply(f.run, f.decision), /Operation completion is uncertain/);
    assert.deepEqual(f.host.store.assignments(f.run.id), before);
    assert.equal(f.host.store.requestById(f.request.id).retired, undefined);
  }

  /** Captures genuine package authority and creates an obsolete dependency through the public store. */
  private fixture(t: TestContext) {
    const f = generalCatalogFixture(t);
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.close());
    const run = host.submit('Complete the original goal');
    const source = host.store.enqueue(run.id, 'a', 'Original work', ['Original criterion']);
    const supplier = host.store.request(source.id, {
      key: 'obsolete',
      owner: 'b',
      objective: 'Incidental requirement',
      acceptance: ['Old evidence'],
    });
    const request = host.store.inbox(source.id)[0]!;
    host.store.fail(source.id, 'blocked', 'Obsolete requirement');
    const decision = this.decision(source.id, request.id);
    const dispatch = new AssignmentDispatch(f.state, context, host.store);
    return { ...f, host, run, source, supplier, request, decision, dispatch };
  }

  /** Supplies an explicit director decision without changing accepted source intent. */
  private decision(assignmentId: string, requestId: string): DirectorResult {
    return {
      status: 'ready',
      summary: 'Resume the original goal',
      selectedOwners: [],
      rejectedOwners: [],
      questions: [],
      assignments: [],
      dependency: null,
      architectureProposal: null,
      continuations: [{ assignmentId, ownerId: 'a', reason: 'The incidental request is obsolete' }],
      dependencyRetirementProposal: { requestId, rationale: 'Obligation is obsolete' },
    };
  }
}

const scenarios = new DependencyRetirementScenarios();

test('ordinary host direction retires a request and retains disconnected history', (t) =>
  scenarios.recover(t));

test('director context captures current request identities and required work', (t) =>
  scenarios.context(t));

test('ordinary host direction replay preserves subsequent progress', (t) => scenarios.replay(t));

test('ordinary host direction retires a waiting obligation without a manufactured failure', (t) =>
  scenarios.waiting(t));

test('ordinary host retirement preserves shared required work', (t) => scenarios.shared(t));

test('ordinary host retirement refuses uncertain descendant operations atomically', (t) =>
  scenarios.uncertain(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'recovery'],
});
