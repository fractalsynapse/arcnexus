import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Client } from 'pg';
import { journalPath } from '../journal-path.js';
import { sqliteBackend } from '../sqlite-store.js';
import { departed } from '../lease.js';
import { verifyCutoverArtifacts } from './cutover-artifacts.js';
import { importSqliteJournal } from './import.js';
import { retireWriter } from './reconcile.js';
import { lockHostedProject } from './session-schema.js';

type Receipt = Awaited<ReturnType<typeof importSqliteJournal>> & {
  artifacts: Record<string, string>;
};

type NativeFence = { digest: string; target: string };
type NativeWriter = { id: string; lease: string };

function fenced(database: DatabaseSync) {
  const table = database
    .prepare("SELECT name FROM sqlite_schema WHERE name = 'hosted_cutover'")
    .get();
  if (table)
    return database.prepare('SELECT digest,target FROM hosted_cutover').get() as NativeFence;
}

async function deploymentIdentity(database: Client) {
  const { rows } = await database.query<{ identity: string }>(
    'SELECT identity FROM arcnexus_coordination.hosted_deployment',
  );
  if (!rows[0]) throw new Error('Hosted deployment identity is unavailable');
  return rows[0].identity;
}

async function activated(database: Client, project: string) {
  const { rows } = await database.query<{ receipt: Receipt }>(
    'SELECT receipt FROM arcnexus_coordination.hosted_projects WHERE project = $1',
    [project],
  );
  return rows[0]?.receipt;
}

function fence(database: DatabaseSync, digest: string, target: string) {
  const prior = fenced(database);
  if (prior && (prior.digest !== digest || prior.target !== target))
    throw new Error('SQLite cutover identity changed');
  if (prior) return;
  database.exec('CREATE TABLE hosted_cutover (digest TEXT NOT NULL,target TEXT NOT NULL) STRICT');
  database.prepare('INSERT INTO hosted_cutover (digest,target) VALUES (?,?)').run(digest, target);
}

/** Verify the source under a native write lock, fence native admission, and activate the target. */
export async function cutoverSqliteJournal(database: Client, storage: string, project: string) {
  const path = journalPath(storage, project);
  if (!existsSync(path)) await initializeAfterDiscovery(database, storage, project);
  const native = new DatabaseSync(path);
  try {
    native.exec('BEGIN IMMEDIATE');
    const target = await deploymentIdentity(database);
    const previous = fenced(native);
    if (previous && previous.target !== target)
      throw new Error('SQLite is fenced to another PostgreSQL deployment');
    const writer = interruptedWriter(native);
    const completed = await activated(database, project);
    if (completed) {
      if (previous?.digest !== completed.digest)
        throw new Error('Native cutover fence is unavailable');
      return writer ? await activate(database, completed, writer) : completed;
    }
    const artifacts = await verifyCutoverArtifacts(native, storage);
    const receipt = { ...(await importSqliteJournal(database, storage, project)), artifacts };
    fence(native, receipt.digest, target);
    native.exec('COMMIT');
    return await activate(database, receipt, writer);
  } finally {
    native.close();
  }
}

/** Establish the empty native fence only for a project that already completed hosted discovery. */
async function initializeAfterDiscovery(database: Client, storage: string, project: string) {
  const verified = await database.query(
    `SELECT 1 FROM arcnexus_coordination.workflow_requests
     WHERE project=$1 AND documentation_only AND state='finished' AND outcome->>'kind'='planned'`,
    [project],
  );
  if (!verified.rowCount) throw new Error('No native journal or completed documentation discovery');
  sqliteBackend(storage).open(project).close();
}

function interruptedWriter(native: DatabaseSync): NativeWriter | undefined {
  const active = native
    .prepare('SELECT CAST(id AS TEXT) AS id, lease, parent_id FROM runs WHERE active = 1')
    .all();
  if (active.some(({ lease }) => !departed(lease)))
    throw new Error('An active SQLite writer prevents cutover');
  const root = active.find(({ parent_id }) => parent_id === null);
  if (root) return { id: String(root.id), lease: String(root.lease) };
}

async function activate(database: Client, receipt: Receipt, writer?: NativeWriter) {
  await database.query('BEGIN');
  try {
    await database.query(lockHostedProject, [receipt.project]);
    if (writer)
      await retireWriter(
        database,
        receipt.project,
        writer.id,
        writer.lease,
        'SQLite writer exited before cutover',
      );
    await database.query(
      `
      INSERT INTO arcnexus_coordination.hosted_projects (project,digest,receipt)
      SELECT project,digest,$3::jsonb FROM arcnexus_coordination.sqlite_imports
      WHERE project=$1 AND digest=$2 ON CONFLICT DO NOTHING
      `,
      [receipt.project, receipt.digest, JSON.stringify(receipt)],
    );
    const completed = await activated(database, receipt.project);
    if (completed?.digest !== receipt.digest)
      throw new Error('Verified migration receipt is unavailable');
    await database.query('COMMIT');
    return completed;
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}
