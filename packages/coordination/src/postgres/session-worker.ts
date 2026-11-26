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

async function open({ connectionString, project, worker, documentationOnly }: Opening) {
  database = new Client({ connectionString });
  database.once('error', () => input.close());
  await database.connect();
  const projectJoined = await database.query(
    documentationOnly
      ? "SELECT project FROM arcnexus_coordination.workflow_requests WHERE project=$1 AND worker=$2 AND state='running' AND documentation_only"
      : 'SELECT project FROM arcnexus_coordination.hosted_projects WHERE project=$1',
    documentationOnly ? [project, worker] : [project],
  );
  if (!projectJoined.rowCount)
    throw new Error(
      documentationOnly
        ? 'No verified documentation request'
        : 'Hosted project cutover has not been verified',
    );
  await database.query("SELECT set_config('arcnexus.project',$1,false)", [project]);
  if (documentationOnly)
    await database.query("SELECT set_config('arcnexus.documentation_only','on',false)");
  for (const [table, columns] of Object.entries(fields)) {
    const filter = documentationOnly ? discoveryWhere(table) : '';
    await database.query(`
      CREATE TEMP VIEW ${table} AS SELECT ${columns} FROM arcnexus_coordination.${table}
      WHERE project=current_setting('arcnexus.project') ${filter} WITH CHECK OPTION
    `);
  }
}

function discoveryWhere(table: string) {
  if (table === 'runs') return 'AND documentation_only';
  if (table === 'events')
    return "AND run IN (SELECT id FROM arcnexus_coordination.runs WHERE project=current_setting('arcnexus.project') AND documentation_only)";
  return 'AND false';
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
