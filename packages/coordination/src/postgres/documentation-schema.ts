/** Add a discovery-only request without weakening the ordinary hosted writer cutover. */
export const documentationDiscoveryMigration = {
  id: 'coordination/documentation-discovery',
  sql: `
    ALTER TABLE arcnexus_coordination.workflow_requests
      ADD COLUMN documentation_only boolean NOT NULL DEFAULT false,
      ADD COLUMN hosted_project text GENERATED ALWAYS AS (
        CASE WHEN NOT documentation_only THEN project ELSE NULL END
      ) STORED REFERENCES arcnexus_coordination.hosted_projects(project),
      DROP CONSTRAINT workflow_requests_project_fkey,
      ADD CONSTRAINT documentation_request CHECK (
        NOT documentation_only OR COALESCE(
          request->>'command' = 'task_plan' AND request->>'mode' = 'recommend-objectives'
            AND NOT request ?| ARRAY['objective', 'draft'], false
        )
      );
    ALTER TABLE arcnexus_coordination.runs
      ADD COLUMN documentation_only boolean NOT NULL
        DEFAULT COALESCE(current_setting('arcnexus.documentation_only', true), 'off') = 'on';
  `,
};
