/** Authorize hosted admission only after the native source is fenced and its import verified. */
export const hostedCoordinationMigration = {
  id: 'coordination/hosted-writer',
  sql: `
    CREATE TABLE arcnexus_coordination.hosted_deployment (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      identity uuid NOT NULL DEFAULT gen_random_uuid()
    );
    INSERT INTO arcnexus_coordination.hosted_deployment DEFAULT VALUES;
    CREATE TABLE arcnexus_coordination.hosted_projects (
      project text PRIMARY KEY REFERENCES arcnexus_coordination.sqlite_imports(project),
      digest text NOT NULL,
      receipt jsonb NOT NULL
    );
    CREATE UNIQUE INDEX hosted_root ON arcnexus_coordination.runs (project)
      WHERE active = 1 AND parent_id IS NULL;
    CREATE UNIQUE INDEX hosted_child ON arcnexus_coordination.runs (project, parent_id)
      WHERE active = 1 AND parent_id IS NOT NULL;
  `,
};
