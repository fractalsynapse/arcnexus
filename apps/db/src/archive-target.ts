import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { readSecret } from '../../../packages/platform/src/index.js';

const execute = promisify(execFile);

/** Use identical explicit libpq settings for the validation client and native archive tools. */
export function archiveTarget(database: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(database) || process.env.ARC_DATABASE_URL)
    throw new Error('Archive operations require explicit PGDATABASE and libpq connection settings');
  const passwordFile = process.env.ARC_DB_PASSWORD_FILE;
  const config = {
    database,
    host: process.env.PGHOST || 'localhost',
    password: passwordFile ? readSecret(passwordFile) : process.env.PGPASSWORD,
  };
  return {
    connect: async () => {
      const client = new Client(config);
      await client.connect();
      return client;
    },
    run: (tool: 'pg_dump' | 'pg_restore', args: string[]) =>
      execute(tool, ['--no-password', ...args], {
        env: {
          ...process.env,
          PGHOST: config.host,
          PGDATABASE: database,
          PGPASSWORD: config.password,
        },
        maxBuffer: Infinity,
      }),
  };
}
