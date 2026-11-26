import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation } from '../../../data/src/index.js';
import {
  preferenceKey,
  preferencesSnapshot,
  preferencesUpdate,
  uiPreferencesResource,
  type UiPreference,
} from './schema.js';

export const uiPreferencesMigration = {
  id: 'ui/preferences',
  sql: `
    CREATE TABLE arcnexus_platform.ui_preferences (
      operator text NOT NULL, key text NOT NULL, setting jsonb NOT NULL,
      PRIMARY KEY (operator, key)
    );
  `,
};

async function read(database: Client, operator: string) {
  const { rows } = await database.query<{ setting: UiPreference }>(
    'SELECT setting FROM arcnexus_platform.ui_preferences WHERE operator = $1 ORDER BY key',
    [operator],
  );
  return { entries: rows.map(({ setting }) => setting) };
}

async function save(
  database: Client,
  operator: string,
  entries: UiPreference[],
  preserveExisting?: boolean,
) {
  const records = [...new Map(entries.map((setting) => [preferenceKey(setting), setting]))].map(
    ([key, setting]) => ({ key, setting }),
  );
  const onConflict = preserveExisting ? 'NOTHING' : 'UPDATE SET setting = EXCLUDED.setting';
  await database.query(
    `INSERT INTO arcnexus_platform.ui_preferences (operator, key, setting)
     SELECT $1, entry.key, entry.setting FROM jsonb_to_recordset($2::jsonb) AS entry(key text, setting jsonb)
     ON CONFLICT (operator, key) DO ${onConflict}`,
    [operator, JSON.stringify(records)],
  );
  return read(database, operator);
}

/** Expose only the authenticated platform operator's appearance and display settings. */
export function uiPreferencesDataPlugin(database: Client) {
  return {
    inject: ['data'],
    /** Contribute the owner schemas and PostgreSQL handlers to the Data SDK. */
    apply(context: Context) {
      const operations = {
        read: dataOperation(z.strictObject({}), preferencesSnapshot, (scope) =>
          read(database, scope.principal),
        ),
        update: dataOperation(
          preferencesUpdate,
          preferencesSnapshot,
          (scope, { entries, preserveExisting }) =>
            save(database, scope.principal, entries, preserveExisting),
        ),
      };
      context.effect(() => context.data.register({ id: uiPreferencesResource, operations }));
    },
  };
}
