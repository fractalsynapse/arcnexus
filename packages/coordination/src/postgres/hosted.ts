import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { Context } from 'cordis';
import { textDigest } from '../../../foundation/src/index.js';
import { reconcileHosted } from './reconcile.js';
import { HostedJournal } from './hosted-journal.js';

const store = 'arcnexus_coordination';

declare module 'cordis' {
  interface Context {
    hostedCoordination: HostedCoordination;
  }
}

type Connection = () => Promise<Client>;

/** Claim the hosted journal behind a verified project cutover and a single active root. */
export class HostedCoordination {
  /** Open a dedicated database connection for each admitted writer. */
  constructor(private readonly connect: Connection) {}

  /** Preserve the active identity when a competing owner already holds the lane. */
  async admit(project: string, goal: string, worker: string) {
    const database = await this.connect();
    try {
      await database.query('BEGIN');
      const writer = await claim(database, project, goal, worker);
      await database.query('COMMIT');
      if (!(writer instanceof HostedJournal)) await database.end();
      return writer;
    } catch (error) {
      await database.end();
      throw error;
    }
  }

  /** Release a departed writer only after confirming its exact trusted identity. */
  async reconcile(project: string, confirmStopped: (owner: string) => boolean | Promise<boolean>) {
    const database = await this.connect();
    try {
      return await reconcileHosted(database, project, confirmStopped);
    } finally {
      await database.end();
    }
  }
}

async function claim(database: Client, project: string, goal: string, worker: string) {
  const assigned = await database.query(
    `SELECT project FROM ${store}.hosted_projects WHERE project=$1 FOR UPDATE`,
    [project],
  );
  if (!assigned.rowCount) throw new Error('Hosted project cutover has not been verified');
  const active = await database.query<{ id: string; goal: string }>(
    `SELECT id,goal FROM ${store}.runs WHERE project=$1 AND active=1 AND parent_id IS NULL`,
    [project],
  );
  if (active.rows[0]) return { activeGoal: active.rows[0].goal, run: Number(active.rows[0].id) };
  return start(database, project, goal, worker);
}

async function start(database: Client, project: string, goal: string, worker: string) {
  const identity = textDigest(goal);
  const lease = JSON.stringify({ worker, id: randomUUID() });
  const { rows } = await database.query<{ id: string }>(
    `
    INSERT INTO ${store}.runs (project,id,goal_id,task_id,goal,active,lease)
    SELECT $1,COALESCE(MAX(id),0)+1,$2,$2,$3,1,$4 FROM ${store}.runs WHERE project=$1
    RETURNING id::text
    `,
    [project, identity, goal, lease],
  );
  return new HostedJournal(database, project, rows[0]!.id, lease, identity, identity);
}

export function hostedCoordinationPlugin(connect: Connection) {
  /** Publish trusted hosted admission without adapting the native writer. */
  return (context: Context) =>
    context.provide('hostedCoordination', new HostedCoordination(connect));
}
