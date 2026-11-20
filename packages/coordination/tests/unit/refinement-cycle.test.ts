import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.invalid/refinement-cycle.git';
const goal = 'Continuous refinement';

/** Exercise foreground cycles and their children through the real SQLite boundary. */
class RefinementFixture {
  readonly store: Coordination;

  /** Isolate the project database and remove it after each scenario. */
  constructor(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-refinement-cycle-'));
    this.store = new Coordination(directory);
    t.after(() => rmSync(directory, { recursive: true, force: true }));
  }

  /** Admit the same foreground command using the existing cycle lifecycle. */
  admit() {
    const journal = this.store.admit(remote, goal, true, 'refine', true);
    assert(journal instanceof Journal);
    return journal;
  }
}

test('a completed refinement starts a fresh invocation and fresh phase identity', (t) => {
  const fixture = new RefinementFixture(t);
  const first = fixture.admit();
  const phase = first.child('Plan', 'round:1:plan');
  assert(phase instanceof Journal);
  phase.finish({ kind: 'planned' });
  first.finish({ kind: 'refined' });
  first.close();

  const next = fixture.admit();
  t.after(() => next.close());
  assert.notEqual(next.taskID, first.taskID);
  const nextPhase = next.child('Plan', 'round:1:plan');
  assert(nextPhase instanceof Journal);
  assert.notEqual(nextPhase.taskID, phase.taskID);
  assert.equal(nextPhase.retained, undefined);
  nextPhase.finish({ kind: 'planned' });
  next.finish({ kind: 'refined' });
});

test('a resumed parent can observe a completed child before acknowledging its outcome', (t) => {
  const fixture = new RefinementFixture(t);
  const first = fixture.admit();
  const phase = first.child('Architect', 'round:1:architect');
  assert(phase instanceof Journal);
  const proposal = { proposal: { baseline: 'base', content: 'exact proposal\n' } };
  const answer = { answer: { approved: false, reason: 'complete answer' } };
  const outcome = { kind: 'planned', decision: 'no change' };
  phase.record(proposal);
  phase.record(answer);
  phase.finish(outcome);
  first.finish({ kind: 'cancelled' });
  first.close();

  const resumed = fixture.admit();
  t.after(() => resumed.close());
  assert.equal(resumed.taskID, first.taskID);
  assert.deepEqual(resumed.childEvents('Architect', 'round:1:architect'), [
    proposal,
    answer,
    { outcome },
  ]);
  resumed.finish({ kind: 'refined' });
});

test('standalone and refinement rounds retain independent unfinished inventories', (t) => {
  const fixture = new RefinementFixture(t);
  const standalone = fixture.store.round(remote, () => 'standalone goals');
  const refine = Reflect.apply(fixture.store.round, fixture.store, [
    remote,
    () => 'refinement goals',
    'refine:invocation:round:1',
  ]) as { id: number; inventory: string };
  assert.notEqual(refine.id, standalone.id);
  assert.equal(refine.inventory, 'refinement goals');
  const resumed = Reflect.apply(fixture.store.round, fixture.store, [
    remote,
    () => 'changed goals',
    'refine:invocation:round:1',
  ]) as { id: number; inventory: string };
  assert.deepEqual(resumed, refine);
  assert.deepEqual(
    fixture.store.round(remote, () => 'changed standalone'),
    standalone,
  );
});

test('an active approval child keeps competing foreground writers out', (t) => {
  const fixture = new RefinementFixture(t);
  const root = fixture.admit();
  t.after(() => root.close());
  const phase = root.child('Architect', 'round:1:architect');
  assert(phase instanceof Journal);
  phase.record({ proposal: { baseline: 'base', content: 'pending' } });
  assert.deepEqual(fixture.store.admit(remote, 'Competing task'), {
    activeGoal: goal,
    run: root.run,
  });
  phase.finish({ kind: 'blocked', reason: 'approval pending' });
  assert.deepEqual(fixture.store.admit(remote, 'Competing task'), {
    activeGoal: goal,
    run: root.run,
  });
  root.finish({ kind: 'blocked', reason: 'approval pending' });
});
