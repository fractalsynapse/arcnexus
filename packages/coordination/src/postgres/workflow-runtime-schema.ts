/** Retain the exact image selected by the first verified Host for this command. */
export const workflowRuntimeMigration = {
  id: 'coordination/workflow-runtime',
  sql: 'ALTER TABLE arcnexus_coordination.workflow_requests ADD COLUMN runtime jsonb',
};
