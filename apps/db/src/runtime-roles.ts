import type { Client } from 'pg';
import { readSecret } from '../../../packages/platform/src/index.js';

const roles = {
  arc_api: {
    secret: 'ARC_API_DB_PASSWORD_FILE',
    grants: `
      GRANT USAGE ON SCHEMA arcnexus_platform TO arc_api;
      GRANT SELECT ON arcnexus_platform.migrations TO arc_api;
      GRANT USAGE ON SCHEMA arcnexus_capacity, arcnexus_catalog, arcnexus_coordination TO arc_api;
      GRANT SELECT, INSERT, UPDATE ON arcnexus_catalog.projects TO arc_api;
      GRANT SELECT, INSERT, DELETE ON arcnexus_capacity.registration_codes TO arc_api;
      GRANT SELECT, INSERT, UPDATE ON arcnexus_capacity.providers TO arc_api;
      GRANT SELECT ON arcnexus_coordination.runs, arcnexus_coordination.events TO arc_api;
    `,
  },
  arc_mcp: {
    secret: 'ARC_MCP_DB_PASSWORD_FILE',
    grants: `
      GRANT USAGE ON SCHEMA arcnexus_platform TO arc_mcp;
      GRANT SELECT ON arcnexus_platform.migrations TO arc_mcp;
      GRANT USAGE ON SCHEMA arcnexus_catalog, arcnexus_coordination TO arc_mcp;
      GRANT SELECT, INSERT, UPDATE ON arcnexus_catalog.projects TO arc_mcp;
      GRANT SELECT ON arcnexus_coordination.runs, arcnexus_coordination.events TO arc_mcp;
    `,
  },
} as const;

type Role = keyof typeof roles;

async function setPassword(database: Client, role: Role, password: string) {
  const exists = await database.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  if (!exists.rowCount) await database.query('CREATE ROLE ' + role);
  const { rows } = await database.query<{ password: string }>(
    'SELECT quote_literal($1) AS password',
    [password],
  );
  await database.query('ALTER ROLE ' + role + ' LOGIN PASSWORD ' + rows[0]!.password);
  await database.query(roles[role].grants);
}

/** Provision named runtime roles under one isolated setup transaction. */
export async function configureRuntimeRoles(database: Client) {
  const configured = (Object.keys(roles) as Role[]).filter(
    (role) => process.env[roles[role].secret],
  );
  if (!configured.length) return;
  await database.query('BEGIN');
  try {
    await database.query("SELECT pg_advisory_xact_lock(hashtext('arcnexus/roles')::bigint)");
    for (const role of configured)
      await setPassword(database, role, readSecret(process.env[roles[role].secret]!));
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}
