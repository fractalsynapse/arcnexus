import type { Client } from 'pg';
import { textDigest } from '../../../packages/foundation/src/index.js';

export interface Migration {
  readonly id: string;
  readonly sql: string;
}

async function apply(database: Client, migration: Migration) {
  const digest = textDigest(migration.sql);
  const { rows } = await database.query<{ digest: string }>(
    'SELECT digest FROM arcnexus_platform.migrations WHERE id = $1',
    [migration.id],
  );
  if (rows[0]) {
    if (rows[0].digest !== digest)
      throw new Error('Previously applied migration changed: ' + migration.id);
    return;
  }
  await database.query(migration.sql);
  await database.query('INSERT INTO arcnexus_platform.migrations (id, digest) VALUES ($1, $2)', [
    migration.id,
    digest,
  ]);
}

/** Apply the captured migration series atomically and serialize competing setup jobs. */
export async function migrate(database: Client, migrations: readonly Migration[]) {
  await database.query('BEGIN');
  try {
    await database.query("SELECT pg_advisory_xact_lock(hashtext('arcnexus/schema')::bigint)");
    await database.query(`
      CREATE SCHEMA IF NOT EXISTS arcnexus_platform;
      CREATE TABLE IF NOT EXISTS arcnexus_platform.migrations (
        id text PRIMARY KEY, digest text NOT NULL
      );
    `);
    for (const migration of migrations) await apply(database, migration);
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}
