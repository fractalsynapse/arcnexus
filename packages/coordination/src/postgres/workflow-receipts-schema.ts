export const workflowReceiptChannel = 'arcnexus_workflow_receipts';

/** Order command admission and signal committed receipt changes to authorized readers. */
export const workflowReceiptsMigration = {
  id: 'coordination/workflow-receipts',
  sql: `
    ALTER TABLE arcnexus_coordination.workflow_requests
      ADD COLUMN ordinal bigint GENERATED ALWAYS AS IDENTITY;
    CREATE INDEX workflow_request_current
      ON arcnexus_coordination.workflow_requests (project,principal,ordinal DESC);
    CREATE FUNCTION arcnexus_coordination.notify_workflow_receipt() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $$
    BEGIN
      PERFORM pg_notify('${workflowReceiptChannel}', encode(sha256(convert_to(NEW.project, 'UTF8')), 'hex'));
      RETURN NULL;
    END
    $$;
    CREATE TRIGGER notify_workflow_receipt AFTER INSERT OR UPDATE
      ON arcnexus_coordination.workflow_requests
      FOR EACH ROW EXECUTE FUNCTION arcnexus_coordination.notify_workflow_receipt();
  `,
};
