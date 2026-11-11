import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { processStart } from '../operations/service-state.js';
import { captureOperationScratch, reclaimOperationScratch } from './operation-scratch.js';
import { ApplicationSettings } from '../portfolio/settings.js';
import type { Environment } from '../architecture/config.js';
import type { CommandResult } from '../operations/process.js';

export interface RecordData {
  id: string;
  source: string;
  workspace: string;
  branch: string;
  branchBase?: string;
  base: string;
  commonDir: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  environment: Environment;
  commands: CommandResult[];
  [key: string]: unknown;
}

/** Resolves configured state without creating storage for read-only resource queries. */
export function statePath(): string {
  return new ApplicationSettings().statePath();
}

export function stateRoot(): string {
  const path = statePath();
  mkdirSync(path, { recursive: true, mode: 0o700 });
  for (const name of ['runs', 'workspaces'])
    mkdirSync(join(path, name), { recursive: true, mode: 0o700 });
  return realpathSync(path);
}

export function lock(root: string): () => void {
  const path = join(root, 'active.lock');
  let fd: number;
  try {
    fd = openSync(path, 'wx', 0o600);
  } catch {
    throw new Error(`An active or interrupted operation owns ${path}; inspect it before recovery`);
  }
  writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  closeSync(fd);
  return () => unlinkSync(path);
}

export function save(root: string, record: RecordData): void {
  captureOperationScratch(root, record);
  const start = processStart(process.pid);
  if (start) record.workspaceOwnerIdentity = { pid: process.pid, start };
  const path = join(root, 'runs', record.id, 'report.json');
  writeFileSync(`${path}.tmp`, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  flush(`${path}.tmp`);
  renameSync(`${path}.tmp`, path);
  flush(join(root, 'runs', record.id));
  if (['completed', 'failed', 'cancelled'].includes(record.status))
    reclaimOperationScratch(root, record, true);
}

/** Flushes run intent and directory entries before managed execution may begin. */
function flush(path: string): void {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
