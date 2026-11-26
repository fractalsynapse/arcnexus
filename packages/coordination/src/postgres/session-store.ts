import { randomUUID } from 'node:crypto';
import { Coordination } from '../index.js';
import type {
  JournalBackend,
  JournalStatement,
  JournalStore,
  JournalValue,
} from '../journal-store.js';
import { SessionPeer } from './session-peer.js';
import { lockHostedProject } from './session-schema.js';

export interface HostedProject {
  project: string;
  worker: string;
  connectionString: string;
  documentationOnly?: boolean;
}

type Parameter = JournalValue | Record<string, JournalValue>;

function bind(sql: string, input: Parameter[]) {
  const values: Array<string | number | null> = [];
  const named = typeof input[0] === 'object' && input[0] !== null ? input[0] : undefined;
  let position = named ? 1 : 0;
  const statement = sql
    .replace(/\b(json_extract|json_type)\(/g, 'arcnexus_coordination.$1(')
    .replace(/:([a-z]+)|\?/g, (_, name?: string) => {
      const value =
        name && named ? (named as Record<string, JournalValue>)[name] : input[position++];
      if (typeof value === 'object' && value !== null)
        throw new Error('Unexpected journal SQL parameter');
      values.push(typeof value === 'bigint' ? value.toString() : (value ?? null));
      return '$' + values.length + (name ? '::bigint' : '');
    });
  return { sql: statement, values };
}

/** Resolve the native lifecycle's small query interface against one project-scoped SQL session. */
class PostgresStore implements JournalStore {
  private readonly peer = new SessionPeer();
  private readonly lease: string;
  readonly signal = this.peer.signal;

  /** Bind the trusted project and worker before accepting a journal query. */
  constructor(
    readonly key: string,
    private readonly project: HostedProject,
  ) {
    this.lease = JSON.stringify({ worker: project.worker, id: randomUUID() });
    try {
      this.peer.request({
        kind: 'open',
        connectionString: project.connectionString,
        project: project.project,
        worker: project.worker,
        documentationOnly: project.documentationOnly,
      });
    } catch (error) {
      this.close();
      throw error;
    }
  }

  /** Return the exact opaque owner identity shared by this writer and its children. */
  holder() {
    return this.lease;
  }

  /** Hosted departures require independent reconciliation through the launcher boundary. */
  canReclaim() {
    return false;
  }

  /** Refuse a stale writer across independent application processes. */
  guard(run?: number) {
    this.signal.throwIfAborted();
    if (run === undefined) return;
    if (
      !this.query('SELECT id FROM runs WHERE id=$1 AND lease=$2 AND active=1', [run, this.lease])
        .rows.length
    )
      this.peer.invalidate(new Error('Hosted writer no longer owns the task'));
  }

  /** Run a journal transaction under the same project lock used by hosted admission. */
  exec(sql: string) {
    if (sql === 'BEGIN IMMEDIATE') {
      this.query('BEGIN');
      this.query(lockHostedProject, [this.project.project]);
      return;
    }
    this.query(sql === 'BEGIN' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : sql);
  }

  /** Preserve native statement results while returning exact PostgreSQL sequence values. */
  prepare(sql: string): JournalStatement {
    const execute = (values: Parameter[], insert = false) => {
      const bound = bind(insert ? sql + ' RETURNING id' : sql, values);
      return this.query(bound.sql, bound.values);
    };
    return {
      all: (...values: Parameter[]) => execute(values).rows,
      get: (...values: Parameter[]) => execute(values).rows[0],
      run: (...values: Parameter[]) => {
        const inserted = /^\s*INSERT INTO /i.test(sql);
        const result = execute(values, inserted);
        return {
          changes: result.changes,
          lastInsertRowid: BigInt(String(result.rows[0]?.id ?? 0)),
        };
      },
    };
  }

  /** Close the writer session while preserving its durable lane if unfinished. */
  close() {
    this.peer.close();
  }

  /** Execute on the dedicated writer and wait for PostgreSQL to acknowledge it. */
  private query(sql: string, values: Array<string | number | null> = []) {
    return this.peer.request({ kind: 'query', sql, values });
  }
}

/** Construct a Host coordination backend bound to one verified project assignment. */
export function hostedProjectCoordination(project: HostedProject) {
  const identity = randomUUID();
  const key = (remote: string) => {
    if (remote !== project.project)
      throw new Error('The hosted writer belongs to a different project');
    return identity;
  };
  const backend: JournalBackend = {
    key,
    open: (remote) => new PostgresStore(key(remote), project),
  };
  return new Coordination(backend);
}
