import type { DatabaseSync } from 'node:sqlite';

/** Prevent a native writer from re-opening a project after its verified cutover. */
export function requireNative(database: DatabaseSync) {
  if (database.prepare("SELECT name FROM sqlite_schema WHERE name = 'hosted_cutover'").get()) {
    throw new Error('This project has been assigned to PostgreSQL');
  }
}

/** Create the native schema and migrate historical records within its write transaction. */
export function initializeSqlite(database: DatabaseSync) {
  database.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE');
  requireNative(database);
  database.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, task_id TEXT, goal TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)), lease TEXT,
        parent_id INTEGER REFERENCES runs(id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS rounds (
        id INTEGER PRIMARY KEY, inventory TEXT NOT NULL, finished INTEGER NOT NULL DEFAULT 0,
        namespace TEXT NOT NULL DEFAULT 'task'
      ) STRICT;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id), content TEXT NOT NULL,
        recorded_at TEXT
      ) STRICT;
    `);
  migrate(database);
  database.exec('COMMIT');
}

/** Upgrade historical task rows and replace the former single-row lane constraint atomically. */
function migrate(database: DatabaseSync) {
  const fields = database
    .prepare('PRAGMA table_info(runs)')
    .all()
    .map(({ name }) => name);
  const events = database.prepare('PRAGMA table_info(events)').all();
  const rounds = database.prepare('PRAGMA table_info(rounds)').all();
  if (!rounds.some(({ name }) => name === 'namespace'))
    database.exec("ALTER TABLE rounds ADD COLUMN namespace TEXT NOT NULL DEFAULT 'task'");
  if (!events.some(({ name }) => name === 'recorded_at'))
    database.exec('ALTER TABLE events ADD COLUMN recorded_at TEXT');
  if (!fields.includes('lease')) database.exec('ALTER TABLE runs ADD COLUMN lease TEXT');
  if (!fields.includes('task_id')) database.exec('ALTER TABLE runs ADD COLUMN task_id TEXT');
  if (!fields.includes('parent_id'))
    database.exec('ALTER TABLE runs ADD COLUMN parent_id INTEGER REFERENCES runs(id)');
  database.exec('UPDATE runs SET task_id = goal_id WHERE task_id IS NULL');
  database.exec(`
    DROP INDEX IF EXISTS one_active_goal;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_root ON runs (active) WHERE active = 1 AND parent_id IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_child ON runs (parent_id) WHERE active = 1 AND parent_id IS NOT NULL;
  `);
}
