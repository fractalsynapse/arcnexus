/** This schema lives with Coordination and preserves its existing journal identities. */
export const coordinationMigration = {
  id: 'coordination/initial',
  sql: `
    CREATE SCHEMA arcnexus_coordination;
    CREATE TABLE arcnexus_coordination.runs (
      project text NOT NULL, id bigint NOT NULL, goal_id text NOT NULL,
      task_id text, goal text NOT NULL, active integer NOT NULL CHECK (active IN (0, 1)),
      lease text, parent_id bigint,
      PRIMARY KEY (project, id),
      FOREIGN KEY (project, parent_id) REFERENCES arcnexus_coordination.runs (project, id)
        DEFERRABLE INITIALLY DEFERRED
    );
    CREATE TABLE arcnexus_coordination.rounds (
      project text NOT NULL, id bigint NOT NULL, inventory text NOT NULL,
      finished integer NOT NULL, namespace text NOT NULL,
      PRIMARY KEY (project, id)
    );
    CREATE TABLE arcnexus_coordination.events (
      project text NOT NULL, id bigint NOT NULL, run bigint NOT NULL,
      content text NOT NULL, recorded_at text,
      PRIMARY KEY (project, id),
      FOREIGN KEY (project, run) REFERENCES arcnexus_coordination.runs (project, id)
    );
    CREATE TABLE arcnexus_coordination.sqlite_imports (
      project text PRIMARY KEY, digest text NOT NULL
    );
  `,
};

export const journalSchema = {
  runs: {
    projection:
      'CAST(id AS text) AS id, goal_id, task_id, goal, CAST(active AS text) AS active, lease, CAST(parent_id AS text) AS parent_id',
    columns: 'id, goal_id, task_id, goal, active, lease, parent_id',
    incoming:
      'id bigint, goal_id text, task_id text, goal text, active integer, lease text, parent_id bigint',
  },
  rounds: {
    projection: 'CAST(id AS text) AS id, inventory, CAST(finished AS text) AS finished, namespace',
    columns: 'id, inventory, finished, namespace',
    incoming: 'id bigint, inventory text, finished integer, namespace text',
  },
  events: {
    projection: 'CAST(id AS text) AS id, CAST(run AS text) AS run, content, recorded_at',
    columns: 'id, run, content, recorded_at',
    incoming: 'id bigint, run bigint, content text, recorded_at text',
  },
} as const;

export type JournalTable = keyof typeof journalSchema;
export type JournalRow = Record<string, string | null>;

export const journalTables = Object.entries(journalSchema) as [
  JournalTable,
  (typeof journalSchema)[JournalTable],
][];
