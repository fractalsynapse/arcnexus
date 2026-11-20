import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal, type JournalEvent } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.invalid/descendant-history.git';
const goal = 'Refinement';
const phaseGoal = 'Architect';
const phaseScope = 'round:1:architect';

interface DescendantJournal {
  childTimeline(goal: string, scope: string): JournalEvent[];
}

/** Exercise real nested admissions across connections to one temporary SQLite store. */
class HistoryFixture {
  readonly store: Coordination;
  root: Journal;
  readonly expected: JournalEvent[] = [];

  /** Create an isolated project and release the connection before removing its storage. */
  constructor(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-descendant-history-'));
    this.store = new Coordination(directory);
    this.root = this.admit();
    t.after(() => {
      this.root.close();
      rmSync(directory, { recursive: true, force: true });
    });
  }

  /** Admit the same unfinished foreground cycle through the public store. */
  admit() {
    const journal = this.store.admit(remote, goal, true, 'refine', true);
    assert(journal instanceof Journal);
    return journal;
  }

  /** Admit a normal nested session and require a real journal. */
  child(parent: Journal, childGoal: string, scope: string) {
    const journal = parent.child(childGoal, scope);
    assert(journal instanceof Journal);
    return journal;
  }

  /** Retain every canonical event of a logical task including recovery observations. */
  collect(journal: Journal) {
    this.expected.push(...journal.timeline());
  }

  /** Finish and reopen the foreground cycle to model an interrupted invocation. */
  reopen() {
    this.root.finish({ kind: 'blocked', reason: 'interrupted' });
    this.root.close();
    this.root = this.admit();
  }
}

/** Populate distinct nested observations, then finish the interrupted first attempt. */
function firstAttempt(fixture: HistoryFixture) {
  const phase = fixture.child(fixture.root, phaseGoal, phaseScope);
  phase.record({ finding: 'architect first finding', answer: 'First line\n\nFull first answer' });
  const task = fixture.child(phase, 'Prerequisite', 'supplier');
  task.record({ finding: 'supplier first finding', profile: 'careful', usage: { input: 123 } });
  task.finish({ kind: 'blocked', reason: 'first attempt' });
  fixture.collect(task);
  phase.finish({ kind: 'blocked', reason: 'pending supplier' });
  fixture.collect(phase);
}

/** Continue both nested logical tasks and preserve their separate terminal observations. */
function continuedAttempt(fixture: HistoryFixture) {
  const phase = fixture.child(fixture.root, phaseGoal, phaseScope);
  phase.record({
    finding: 'architect resumed finding',
    answer: 'Second line\n\nFull second answer',
  });
  const task = fixture.child(phase, 'Prerequisite', 'supplier');
  task.record({ finding: 'supplier resumed finding', profile: 'fast', usage: { output: 47 } });
  const nested = fixture.child(task, 'Nested review', 'review');
  nested.record({ finding: 'nested review finding', answer: 'Complete\nreview answer' });
  nested.finish({ kind: 'satisfied' });
  fixture.collect(nested);
  task.finish({ kind: 'merged', commit: 'delivered-commit' });
  fixture.collect(task);
  phase.finish({ kind: 'planned' });
  fixture.collect(phase);
}

/** Record distinguishable neighboring tasks that must never enter the selected history. */
function otherScopes(fixture: HistoryFixture) {
  for (const scope of ['round:1:plan', 'round:2:architect']) {
    const sibling = fixture.child(fixture.root, phaseGoal, scope);
    const nested = fixture.child(sibling, 'Prerequisite', 'supplier');
    nested.record({ finding: `excluded ${scope}` });
    nested.finish({ kind: 'satisfied' });
    sibling.finish({ kind: 'planned' });
  }
}

/** Compare canonical events once each, irrespective of duplicate timeline collection. */
function uniqueOrdered(events: JournalEvent[]) {
  return [...new Map(events.map((event) => [event.sequence, event])).values()].sort((a, b) =>
    BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1,
  );
}

test('child history includes canonical descendants across retries and excludes other cycles', (t) => {
  const fixture = new HistoryFixture(t);
  firstAttempt(fixture);
  fixture.reopen();
  continuedAttempt(fixture);
  otherScopes(fixture);
  const immediate = fixture.root.childEvents(phaseGoal, phaseScope);
  assert(immediate.some((value) => JSON.stringify(value).includes('architect first finding')));
  assert(!immediate.some((value) => JSON.stringify(value).includes('supplier first finding')));
  const expected = uniqueOrdered(fixture.expected);
  const query = fixture.root as unknown as Partial<DescendantJournal>;
  assert.equal(typeof query.childTimeline, 'function', 'public descendant timeline is available');
  assert.deepEqual(query.childTimeline!(phaseGoal, phaseScope), expected);
  fixture.root.finish({ kind: 'refined' });
  fixture.root.close();
  const unrelated = fixture.store.admit(remote, 'Unrelated root');
  assert(unrelated instanceof Journal);
  unrelated.record({ finding: 'excluded unrelated root' });
  unrelated.finish({ kind: 'satisfied' });
  unrelated.close();
  fixture.root = fixture.admit();
  const fresh = fixture.child(fixture.root, phaseGoal, phaseScope);
  fresh.record({ finding: 'excluded fresh invocation' });
  fresh.finish({ kind: 'planned' });
  const freshExpected = fresh.timeline();
  assert.deepEqual(
    (fixture.root as unknown as DescendantJournal).childTimeline(phaseGoal, phaseScope),
    freshExpected,
  );
  fixture.root.finish({ kind: 'blocked' });
  fixture.root.close();
  fixture.root = fixture.admit();
  assert.deepEqual(
    (fixture.root as unknown as DescendantJournal).childTimeline(phaseGoal, phaseScope),
    freshExpected,
  );
});
