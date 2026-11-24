import { DatabaseSync } from 'node:sqlite';
import type { Client } from 'pg';
import { textDigest } from '../../../foundation/src/index.js';
import { journalPath } from '../journal-path.js';
import { journalTables, type JournalRow, type JournalTable } from './schema.js';

type Snapshot = Partial<Record<JournalTable, JournalRow[]>>;

/** Capture a consistent copy of the verified SQLite namespace without changing it. */
function sqliteSnapshot(storage: string, remote: string) {
  const database = new DatabaseSync(journalPath(storage, remote), { readOnly: true });
  try {
    database.exec('BEGIN');
    const snapshot: Snapshot = {};
    for (const [table, { projection }] of journalTables) {
      const rows = database
        .prepare(`SELECT ${projection} FROM ${table} ORDER BY ${table}.id`)
        .all();
      snapshot[table] = rows as JournalRow[];
    }
    return snapshot;
  } finally {
    database.close();
  }
}

/** Inspect copied bytes in canonical row order before issuing a receipt. */
async function postgresSnapshot(database: Client, project: string) {
  const snapshot: Snapshot = {};
  for (const [table, { projection }] of journalTables) {
    const result = await database.query<JournalRow>(
      `SELECT ${projection} FROM arcnexus_coordination.${table} WHERE project = $1 ORDER BY ${table}.id`,
      [project],
    );
    snapshot[table] = result.rows;
  }
  return snapshot;
}

async function copy(database: Client, project: string, snapshot: Snapshot) {
  for (const [table, { columns, incoming }] of journalTables) {
    await database.query(
      `INSERT INTO arcnexus_coordination.${table} (project, ${columns})
       SELECT $1, ${columns} FROM jsonb_to_recordset($2::jsonb) AS captured (${incoming})`,
      [project, JSON.stringify(snapshot[table])],
    );
  }
}

async function verifiedCopy(database: Client, remote: string, snapshot: Snapshot, digest: string) {
  const { rows } = await database.query<{ digest: string }>(
    'SELECT digest FROM arcnexus_coordination.sqlite_imports WHERE project = $1',
    [remote],
  );
  if (rows[0] && rows[0].digest !== digest)
    throw new Error('Another SQLite snapshot is already imported');
  if (!rows[0]) await copy(database, remote, snapshot);
  const candidate = await postgresSnapshot(database, remote);
  if (textDigest(JSON.stringify(candidate)) !== digest)
    throw new Error('Imported journal differs from its captured SQLite source');
  if (!rows[0])
    await database.query(
      'INSERT INTO arcnexus_coordination.sqlite_imports (project, digest) VALUES ($1, $2)',
      [remote, digest],
    );
}

/** Rehearse migration into a prepared target and verify every copied row in the same transaction. */
export async function importSqliteJournal(database: Client, storage: string, remote: string) {
  const snapshot = sqliteSnapshot(storage, remote);
  const digest = textDigest(JSON.stringify(snapshot));
  await database.query('BEGIN');
  try {
    await database.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
      'arc-import:' + remote,
    ]);
    await verifiedCopy(database, remote, snapshot, digest);
    await database.query('COMMIT');
    return {
      project: remote,
      digest,
      rows: Object.fromEntries(
        journalTables.map(([table]) => [table, snapshot[table]?.length ?? 0]),
      ),
    };
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}
