import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Client } from 'pg';
import { z } from 'zod';
import { fileDigest } from '../../../packages/foundation/src/index.js';
import { archiveTarget } from './archive-target.js';

const manifest = z.strictObject({ snapshot: z.string().min(1), archive: z.hex().length(64) });
const archive = 'platform.dump';
const metadata = 'manifest.json';
type Target = ReturnType<typeof archiveTarget>;
type Verify = (database: Client) => Promise<void>;

async function checkSource(database: Client) {
  const { rows } = await database.query<{ busy: boolean }>(`
    SELECT EXISTS(SELECT 1 FROM arcnexus_coordination.runs WHERE active=1)
        OR EXISTS(SELECT 1 FROM arcnexus_coordination.workflow_requests WHERE state IN ('queued','running'))
        OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid())
    AS busy
  `);
  if (rows[0]?.busy) throw new Error('Quiesce the gateways and Hosts before backup');
}

async function checkDestination(database: Client) {
  const { rows } = await database.query<{ occupied: boolean }>(`
    SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema'))
      OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace)
      OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace)
      OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace)
      OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid())
    AS occupied
  `);
  if (rows[0]?.occupied)
    throw new Error('Restore requires an empty database with no other connections');
}

async function withTarget<T>(target: Target, operation: (database: Client) => Promise<T>) {
  const database = await target.connect();
  try {
    return await operation(database);
  } finally {
    await database.end();
  }
}

async function writeArchive(target: Target, verify: Verify, location: string, snapshot: string) {
  if (!snapshot.trim()) throw new Error('Supply the matching Host snapshot identity');
  await withTarget(target, async (database) => {
    await verify(database);
    await checkSource(database);
  });
  await mkdir(location, { mode: 0o700 });
  try {
    const path = join(location, archive);
    await target.run('pg_dump', [
      '--format=custom',
      '--schema=arcnexus_*',
      '--no-owner',
      '--no-privileges',
      '--file',
      path,
    ]);
    const result = manifest.parse({ snapshot, archive: await fileDigest(path) });
    await writeFile(join(location, metadata), JSON.stringify(result) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    return result;
  } catch (error) {
    await rm(location, { recursive: true, force: true });
    throw error;
  }
}

async function verifyArchive(location: string, snapshot: string) {
  const record = manifest.parse(
    JSON.parse(await readFile(join(location, metadata), 'utf8')) as unknown,
  );
  const path = join(location, archive);
  const stat = await lstat(path);
  if (record.snapshot !== snapshot) throw new Error('The Host snapshot identity differs');
  if (!stat.isFile() || stat.nlink !== 1 || record.archive !== (await fileDigest(path)))
    throw new Error('The database archive digest differs');
  return { path, record };
}

/** Back up an isolated platform state and restore it into a new operator-selected database. */
export function databaseArchives(verify: Verify) {
  return {
    backup: (database: string, location: string, snapshot: string) =>
      writeArchive(archiveTarget(database), verify, location, snapshot),
    async restore(database: string, location: string, snapshot: string) {
      const { path, record } = await verifyArchive(location, snapshot);
      const target = archiveTarget(database);
      await withTarget(target, checkDestination);
      await target.run('pg_restore', [
        '--single-transaction',
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--dbname',
        database,
        path,
      ]);
      await withTarget(target, verify);
      return record;
    },
  };
}
