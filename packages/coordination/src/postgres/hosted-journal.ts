import type { Client } from 'pg';
import type { JournalEvent } from '../journal-types.js';

const store = 'arcnexus_coordination';
const append = `
  WITH owner AS (
    UPDATE ${store}.runs SET active = CASE WHEN $5 THEN 0 ELSE active END
    WHERE project=$1 AND id=$2 AND lease=$3 AND active=1
    RETURNING id, goal_id
  ), next AS (
    SELECT COALESCE(MAX(id),0)+1 AS id FROM ${store}.events WHERE project=$1
  )
  INSERT INTO ${store}.events (project,id,run,content,recorded_at)
  SELECT $1,next.id,owner.id,$4,$6 FROM owner CROSS JOIN next
  RETURNING id::text AS sequence
`;

/** Own a claimed writer connection until a terminal transaction or an observed disconnect. */
export class HostedJournal {
  private readonly lifetime = new AbortController();
  readonly signal = this.lifetime.signal;

  /** Bind the exact admitted row and opaque lease to this one connection. */
  constructor(
    private readonly database: Client,
    private readonly project: string,
    private readonly row: string,
    private readonly lease: string,
    readonly taskID: string,
    readonly goalID: string,
  ) {
    database.on('error', (error) => this.lifetime.abort(error));
    database.once('end', () => this.lifetime.abort(new Error('Hosted writer disconnected')));
  }

  /** Expose the run number used in existing event models. */
  get run() {
    return Number(this.row);
  }

  /** Append behind an atomic ownership check on the existing canonical row. */
  record(observation: unknown) {
    return this.append(observation, false);
  }

  /** Commit the last observation and release this project lane atomically. */
  finish(outcome: unknown) {
    return this.append({ outcome }, true);
  }

  /** Disconnect without erasing an unfinished position. */
  async close() {
    if (!this.signal.aborted) this.lifetime.abort(new Error('Hosted writer closed'));
    await this.database.end();
  }

  /** Return the complete observation using the committed PostgreSQL sequence. */
  private async append(observation: unknown, terminal: boolean): Promise<JournalEvent> {
    this.signal.throwIfAborted();
    const timestamp = new Date().toISOString();
    const content = JSON.stringify(observation);
    const result = await this.database.query<{ sequence: string }>(append, [
      this.project,
      this.row,
      this.lease,
      content,
      terminal,
      timestamp,
    ]);
    if (!result.rows[0]) {
      this.lifetime.abort(new Error('Hosted writer no longer owns the task'));
      throw this.signal.reason;
    }
    return {
      sequence: result.rows[0].sequence,
      run: this.run,
      taskID: this.taskID,
      goalID: this.goalID,
      timestamp,
      observation: JSON.parse(content) as unknown,
    };
  }
}
