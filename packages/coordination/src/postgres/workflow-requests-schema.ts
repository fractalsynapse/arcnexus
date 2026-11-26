/** Keep durable command admission and operator decisions alongside the authoritative journal. */
export const workflowRequestsMigration = {
  id: 'coordination/workflow-requests',
  sql: `
    CREATE TABLE arcnexus_coordination.workflow_requests (
      id uuid PRIMARY KEY,
      project text NOT NULL REFERENCES arcnexus_coordination.hosted_projects(project),
      principal text NOT NULL,
      request jsonb NOT NULL,
      revision text NOT NULL,
      state text NOT NULL CHECK (state IN ('queued','running','waiting','finished')),
      worker text,
      execution text,
      gate jsonb,
      reply text,
      outcome jsonb,
      cancellation boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX workflow_request_active ON arcnexus_coordination.workflow_requests (project)
      WHERE state <> 'finished';
    CREATE FUNCTION arcnexus_coordination.notify_workflow_request() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $$
    BEGIN
      IF NEW.state = 'queued' OR NEW.cancellation THEN
        PERFORM pg_notify('arcnexus_workflow_requests', encode(sha256(convert_to(NEW.project, 'UTF8')), 'hex'));
      END IF;
      RETURN NULL;
    END
    $$;
    CREATE TRIGGER notify_workflow_request AFTER INSERT OR UPDATE
      ON arcnexus_coordination.workflow_requests
      FOR EACH ROW EXECUTE FUNCTION arcnexus_coordination.notify_workflow_request();
  `,
};

/** Preserve the operator's source selection across Host claims and approval resumes. */
export const workflowDocumentationMigration = {
  id: 'coordination/workflow-documentation-directories',
  sql: `ALTER TABLE arcnexus_coordination.workflow_requests ADD COLUMN documentation_directories jsonb;`,
};
