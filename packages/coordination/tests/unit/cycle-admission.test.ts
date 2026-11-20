import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.invalid/assessment-cycles.git';
const goal = 'Assess accepted architecture';

/** Keep one real project store while independently restarting its foreground invocations. */
class CycleFixture {
  readonly store: Coordination;

  /** Isolate durable observations from all real project and qualification stores. */
  constructor(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-cycle-admission-'));
    this.store = new Coordination(directory);
    t.after(() => rmSync(directory, { recursive: true, force: true }));
  }

  /** Claim the real admission path with fresh-cycle behavior for repeated assessment commands. */
  admit() {
    return this.store.admit(remote, goal, true, 'architecture:update', true);
  }
}

test('a finished assessment begins a fresh logical cycle even on an unchanged source revision', (t) => {
  const fixture = new CycleFixture(t);
  const first = fixture.admit();
  assert(first instanceof Journal);
  first.finish({ kind: 'planned' });
  first.close();
  const next = fixture.admit();
  assert(next instanceof Journal);
  assert.notEqual(next.taskID, first.taskID);
  assert.equal(next.retained, undefined);
  next.finish({ kind: 'planned' });
  next.close();
});

test('an interrupted approval retains the exact logical cycle and proposal bytes', (t) => {
  const fixture = new CycleFixture(t);
  const first = fixture.admit();
  assert(first instanceof Journal);
  const pending = { proposal: { id: 'exact', content: 'unchanged bytes', baseline: 'captured' } };
  first.record(pending);
  first.finish({ kind: 'blocked' });
  first.close();
  const resumed = fixture.admit();
  assert(resumed instanceof Journal);
  assert.equal(resumed.taskID, first.taskID);
  assert(
    resumed.retained?.events.some((event) => JSON.stringify(event) === JSON.stringify(pending)),
  );
  resumed.finish({ kind: 'planned' });
  resumed.close();
});

test('a repeated foreground assessment still refuses an active cycle writer', (t) => {
  const fixture = new CycleFixture(t);
  const first = fixture.admit();
  assert(first instanceof Journal);
  assert.deepEqual(fixture.admit(), { activeGoal: goal, run: first.run });
  first.finish({ kind: 'planned' });
  first.close();
});
