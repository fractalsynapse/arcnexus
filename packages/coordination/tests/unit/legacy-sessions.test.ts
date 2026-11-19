import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

const remote = 'https://example.invalid/legacy-sessions.git';
const goal = 'Retained standalone work';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Construct the historical public store schema without the later identity and parent columns. */
function legacyStore(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-legacy-sessions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const folder = join(directory, digest(remote));
  mkdirSync(folder);
  const database = new DatabaseSync(join(folder, 'tasks.sqlite'));
  database.exec(`
    CREATE TABLE runs (id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, goal TEXT NOT NULL,
      active INTEGER NOT NULL CHECK (active IN (0, 1))) STRICT;
    CREATE UNIQUE INDEX one_active_goal ON runs (active) WHERE active = 1;
    CREATE TABLE events (id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id),
      content TEXT NOT NULL) STRICT;
  `);
  database.prepare('INSERT INTO runs VALUES (1, ?, ?, 0)').run(digest(goal), goal);
  database
    .prepare('INSERT INTO events VALUES (1, 1, ?)')
    .run(JSON.stringify({ checkpoint: 'original-head' }));
  database.close();
  return new Coordination(directory);
}

test('historical standalone evidence survives parent-aware admission and its lane migration', (t) => {
  const store = legacyStore(t);
  const root = store.admit(remote, goal);
  assert(root instanceof Journal);
  t.after(() => root.close());
  assert.deepEqual(root.retained?.events, [{ checkpoint: 'original-head' }]);
  const child = root.child('Prerequisite', 'implementation');
  assert(child instanceof Journal);
  assert.deepEqual(store.admit(remote, 'Competing invocation'), {
    activeGoal: goal,
    run: root.run,
  });
  child.finish({ kind: 'merged' });
  child.close();
  root.finish({ kind: 'refined' });
});
