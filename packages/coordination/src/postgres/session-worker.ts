import { createInterface } from 'node:readline';
import { Client } from 'pg';
import { sendFrame, type SessionRequest, type SessionResult } from './session-protocol.js';

const fields = {
  runs: 'id,goal_id,task_id,goal,active,lease,parent_id',
  rounds: 'id,inventory,finished,namespace',
  events: 'id,run,content,recorded_at',
};

const input = createInterface({ input: process.stdin });
let database: Client | undefined;

type Opening = Extract<SessionRequest, { kind: 'open' }>;

async function open({ connectionString, project }: Opening) {
  database = new Client({ connectionString });
  database.once('error', () => input.close());
  await database.connect();
  const projectJoined = await database.query(
    'SELECT project FROM arcnexus_coordination.hosted_projects WHERE project=$1',
    [project],
  );
  if (!projectJoined.rowCount) throw new Error('Hosted project cutover has not been verified');
  await database.query("SELECT set_config('arcnexus.project',$1,false)", [project]);
  for (const [table, columns] of Object.entries(fields)) {
    await database.query(`
      CREATE TEMP VIEW ${table} AS SELECT ${columns} FROM arcnexus_coordination.${table}
      WHERE project=current_setting('arcnexus.project') WITH CHECK OPTION
    `);
  }
}

async function handle(message: SessionRequest): Promise<SessionResult> {
  if (message.kind === 'open') {
    await open(message);
    return { rows: [], changes: 0 };
  }
  if (!database) throw new Error('PostgreSQL writer session is unavailable');
  if (message.kind === 'close') return { rows: [], changes: 0 };
  const result = await database.query(message.sql, message.values);
  return { rows: result.rows, changes: result.rowCount ?? 0 };
}

try {
  for await (const frame of input) {
    const message = JSON.parse(frame) as SessionRequest;
    try {
      sendFrame(1, { ok: true, result: await handle(message) });
      if (message.kind === 'close') break;
    } catch (error) {
      sendFrame(1, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
} finally {
  if (database) await database.end();
}
