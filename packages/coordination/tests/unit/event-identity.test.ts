import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

interface ObservedEvent {
  sequence: string;
  run: number;
  taskID: string;
  timestamp: string;
  observation: unknown;
}

/** Verify event identities against the actual durable SQLite records, not a mock journal. */
class EventScenario {
  readonly journal: Journal;
  readonly database: DatabaseSync;

  /** Isolate one project writer and a separate read-only observer connection. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-event-identity-'));
    const store = new Coordination(root);
    const journal = store.admit('https://example.invalid/events.git', 'Observe real events');
    assert(journal instanceof Journal);
    this.journal = journal;
    const identity = createHash('sha256')
      .update('https://example.invalid/events.git')
      .digest('hex');
    const main = join(root, identity, 'tasks.sqlite');
    this.database = new DatabaseSync(main, { readOnly: true });
    t.after(() => {
      this.database.close();
      journal.close();
      rmSync(root, { recursive: true, force: true });
    });
  }

  /** Compare a public event receipt with the already committed canonical row. */
  assertRecorded(value: unknown, expected: unknown) {
    assert(value && typeof value === 'object', 'record must return its durable event identity');
    const frame = value as ObservedEvent;
    assert.equal(frame.run, this.journal.run);
    assert.equal(frame.taskID, this.journal.taskID);
    assert.equal(new Date(frame.timestamp).toISOString(), frame.timestamp);
    assert.deepEqual(frame.observation, expected);
    const row = this.database
      .prepare('SELECT content, recorded_at FROM events WHERE id=?')
      .get(frame.sequence);
    assert(row, 'receipt must identify a row visible to another connection');
    assert.deepEqual(JSON.parse(String(row.content)), expected);
    assert.equal(row.recorded_at, frame.timestamp);
    return frame;
  }
}

test('CO-24: event identity and timestamp identify the committed observation', (t) => {
  const scenario = new EventScenario(t);
  const observation = { operation: { owner: 'work', result: 'complete café 🛠' } };
  const first = scenario.assertRecorded(scenario.journal.record(observation), observation);
  const next = scenario.assertRecorded(scenario.journal.record({ next: true }), { next: true });
  assert(BigInt(next.sequence) > BigInt(first.sequence));
  assert.deepEqual(scenario.journal.timeline(), [first, next]);
  assert.deepEqual(scenario.journal.events(), [observation, { next: true }]);
});

test('CO-24: terminal receipt is published only after its state and event commit', (t) => {
  const scenario = new EventScenario(t);
  const outcome = { kind: 'blocked', reason: 'Exact diagnostic' };
  scenario.assertRecorded(scenario.journal.finish(outcome), { outcome });
  assert.equal(
    scenario.database.prepare('SELECT active FROM runs WHERE id=?').get(scenario.journal.run)
      ?.active,
    0,
  );
});
