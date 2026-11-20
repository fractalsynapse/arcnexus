import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.invalid/child-sessions.git';

/** Exercise real writer admission and child journals in one temporary project database. */
class SessionFixture {
  readonly store: Coordination;
  root: Journal;

  /** Own the foreground connection until all scenario assertions finish. */
  constructor(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-child-sessions-'));
    this.store = new Coordination(directory);
    const root = this.store.admit(remote, 'Foreground refinement');
    assert(root instanceof Journal);
    this.root = root;
    t.after(() => {
      this.root.close();
      rmSync(directory, { recursive: true, force: true });
    });
  }

  /** Assert that another invocation cannot take the ancestor's retained foreground lane. */
  assertHeld() {
    assert.deepEqual(this.store.admit(remote, 'Another invocation'), {
      activeGoal: this.root.goal,
      run: this.root.run,
    });
  }
}

test('child completion and closure retain the foreground writer across sequential phases', (t) => {
  const fixture = new SessionFixture(t);
  fixture.assertHeld();
  const child = fixture.root.child('Plan', 'round:1:plan');
  assert(child instanceof Journal);
  fixture.assertHeld();
  child.finish({ kind: 'planned' });
  child.close();
  fixture.assertHeld();
  const next = fixture.root.child('Architect', 'round:1:architect');
  assert(next instanceof Journal);
  assert.notEqual(next.taskID, child.taskID);
  assert.equal(next.retained, undefined);
  next.finish({ kind: 'planned' });
  next.close();
  fixture.root.finish({ kind: 'refined' });
  const admitted = fixture.store.admit(remote, 'Another invocation');
  assert(admitted instanceof Journal);
  admitted.finish({ kind: 'planned' });
  admitted.close();
});

test('an active prerequisite blocks siblings and premature ancestor completion', (t) => {
  const fixture = new SessionFixture(t);
  const phase = fixture.root.child('Architect', 'round:1:architect');
  assert(phase instanceof Journal);
  const task = phase.child('Implement prerequisite', 'prerequisite');
  assert(task instanceof Journal);
  assert.deepEqual(phase.child('Another task', 'sibling'), {
    activeGoal: task.goal,
    run: task.run,
  });
  assert.deepEqual(fixture.root.child('Run', 'round:1:run'), {
    activeGoal: phase.goal,
    run: phase.run,
  });
  assert.throws(() => phase.finish({ kind: 'planned' }), /active child/);
  assert.throws(() => fixture.root.finish({ kind: 'refined' }), /active child/);
  fixture.assertHeld();
  task.finish({ kind: 'merged' });
  phase.finish({ kind: 'planned' });
  fixture.root.finish({ kind: 'refined' });
});

test('a restarted phase reuses its exact child identity and retained answers and checkpoints', (t) => {
  const fixture = new SessionFixture(t);
  const first = fixture.root.child('Architect', 'round:1:architect');
  assert(first instanceof Journal);
  const evidence = { answer: 'Exact complete answer', checkpoint: 'retained-head', issue: '10' };
  first.record(evidence);
  first.finish({ kind: 'blocked' });
  first.close();
  fixture.root.finish({ kind: 'blocked' });
  fixture.root.close();
  const retry = fixture.store.admit(remote, fixture.root.goal);
  assert(retry instanceof Journal);
  fixture.root = retry;
  const resumed = retry.child('Architect', 'round:1:architect');
  assert(resumed instanceof Journal);
  assert.equal(resumed.taskID, first.taskID);
  assert.deepEqual(resumed.retained?.events[0], evidence);
  resumed.finish({ kind: 'planned' });
  assert.throws(() => resumed.child('Task', 'late'), /inactive parent/);
  retry.finish({ kind: 'refined' });
});

test('a hard-crashed writer stack is retired once and its child evidence survives reconstruction', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-child-crash-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixture = fileURLToPath(new URL('../fixtures/crashed-writer.js', import.meta.url));
  assert.throws(() => execFileSync(process.execPath, [fixture, directory, remote]), {
    signal: 'SIGKILL',
  });
  const store = new Coordination(directory);
  assert.deepEqual(store.admit(remote, 'Unrelated invocation'), {
    activeGoal: 'Foreground refinement',
    run: 1,
  });
  const root = store.admit(remote, 'Foreground refinement');
  assert(root instanceof Journal);
  t.after(() => root.close());
  const phase = root.child('Architect', 'round:1:architect');
  assert(phase instanceof Journal);
  const task = phase.child('Prerequisite', 'implementation');
  assert(task instanceof Journal);
  assert.deepEqual(task.retained?.events, [
    { answer: 'Complete retained answer', checkpoint: 'secured-head', issue: '10' },
    { outcome: { kind: 'cancelled', reason: 'Task writer exited', evidence: [] } },
  ]);
  task.finish({ kind: 'merged' });
  phase.finish({ kind: 'planned' });
  root.finish({ kind: 'refined' });
});
