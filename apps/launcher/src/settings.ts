import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { providerIdentitySchema } from '../../../packages/capacity/src/index.js';
import { endpoint, type Identity } from './connection.js';

const config = z.strictObject({ api: z.string(), mcp: z.string() });
const storedIdentity = z.strictObject({ api: z.string(), identity: providerIdentitySchema });

const directory = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'arcnexus',
  'launcher',
);

function load(name: string) {
  try {
    return JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function save(name: string, value: unknown) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(join(directory, '.write-'));
  try {
    const staged = join(temporary, name);
    writeFileSync(staged, JSON.stringify(value) + '\n', { mode: 0o600 });
    renameSync(staged, join(directory, name));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function configure(api: string, mcp: string) {
  save('config.json', { api: endpoint(api), mcp: endpoint(mcp) });
}

export function settings() {
  const saved = config.optional().parse(load('config.json'));
  return config.parse({
    api: process.env.ARC_API_URL ?? saved?.api,
    mcp: process.env.ARC_MCP_URL ?? saved?.mcp,
  });
}

export function saveIdentity(api: string, identity: Identity) {
  save('identity.json', { api: endpoint(api), identity });
}

export function identityFor(api: string) {
  const stored = storedIdentity.parse(load('identity.json'));
  if (stored.api !== endpoint(api))
    throw new Error('Launcher identity belongs to a different platform');
  return stored.identity;
}
