import { readFileSync } from 'node:fs';
import { Client } from 'pg';

/** Load a dedicated application's credential from its mounted Docker secret. */
export async function connectDatabase() {
  const connectionString = process.env.ARC_DATABASE_URL;
  const file = process.env.ARC_DB_PASSWORD_FILE;
  if (!connectionString && !file) throw new Error('Configure a database connection');
  const password = file ? readSecret(file) : undefined;
  const database = new Client({ connectionString, password });
  await database.connect();
  return database;
}

/** Read a mounted credential without putting its bytes in process arguments. */
export function readSecret(file: string) {
  const secret = readFileSync(file, 'utf8').trim();
  if (!secret) throw new Error('A configured secret file is empty');
  return secret;
}
