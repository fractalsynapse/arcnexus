import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { assertServicesStopped, processStart } from '../operations/service-state.js';

interface ScratchRecord {
  id: string;
  status: string;
  source?: string;
  workspace?: string;
  operationTemporaryRoot?: unknown;
  operationScratchIdentity?: unknown;
  operationInvocations?: unknown;
}

interface ResourceIdentity {
  path: string;
  device: number;
  inode: number;
}

interface ScratchIdentity {
  id: string;
  ownerPid: number;
  ownerStart: string;
  temporary: ResourceIdentity;
  configuration: ResourceIdentity;
}

export type ProcessOwnership = 'live' | 'absent' | 'unknown';

/** Distinguishes a matching live process from a dead or unidentifiable owner. */
export function processOwnership(pid: number, start: string): ProcessOwnership {
  if (!Number.isInteger(pid) || pid <= 1 || !/^\d+$/.test(start)) return 'unknown';
  const current = processStart(pid);
  if (current !== undefined) return current === start ? 'live' : 'absent';
  try {
    process.kill(pid, 0);
    return 'unknown';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'absent' : 'unknown';
  }
}

/** Captures disposable operation paths without importing workspace cleanup or lifecycle modules. */
export function captureOperationScratch(root: string, record: ScratchRecord): void {
  if (typeof record.operationTemporaryRoot !== 'string') return;
  const currentStart = processStart(process.pid);
  if (!currentStart) throw new Error('Cannot establish operation scratch process identity');
  if (record.operationScratchIdentity) {
    const identity = record.operationScratchIdentity as ScratchIdentity;
    validateScratchIdentity(root, record, identity);
    record.operationScratchIdentity = {
      ...identity,
      ownerPid: process.pid,
      ownerStart: currentStart,
    } satisfies ScratchIdentity;
    return;
  }
  const configurationPath = record.operationTemporaryRoot + '-configuration';
  mkdirSync(configurationPath, { recursive: true, mode: 0o700 });
  const temporary = identity(root, record, record.operationTemporaryRoot);
  const configuration = identity(root, record, configurationPath);
  record.operationScratchIdentity = {
    id: randomUUID(),
    ownerPid: process.pid,
    ownerStart: currentStart,
    temporary,
    configuration,
  } satisfies ScratchIdentity;
}

/** Removes captured roots only after invocation, service and process ownership checks pass. */
export function reclaimOperationScratch(
  root: string,
  record: ScratchRecord,
  allowCurrentOwner: boolean,
): boolean {
  const value = record.operationScratchIdentity as ScratchIdentity | undefined;
  if (
    record.status === 'prepared' ||
    !value ||
    value.id.length < 16 ||
    !operationInvocationsSettled(record)
  )
    return false;
  try {
    validateScratchIdentity(root, record, value);
    assertServicesStopped(root, record.id);
    const ownership = processOwnership(value.ownerPid, value.ownerStart);
    if (
      ownership === 'unknown' ||
      (ownership === 'live' && !(allowCurrentOwner && value.ownerPid === process.pid))
    )
      return false;
    remove(value.temporary);
    remove(value.configuration);
    return true;
  } catch {
    return false;
  }
}

/** Requires invocation outcomes to prove that no operation was interrupted or still running. */
export function operationInvocationsSettled(record: ScratchRecord): boolean {
  const invocations = record.operationInvocations as Array<{ status?: string }> | undefined;
  return (
    !invocations ||
    invocations.every((item) => ['completed', 'failed', 'cancelled'].includes(String(item.status)))
  );
}

/** Binds each disposable path to its record, the host temporary directory and captured inode identity. */
function identity(root: string, record: ScratchRecord, path: string): ResourceIdentity {
  const absolute = resolve(path),
    stat = lstatSync(absolute);
  if (
    !absolute.startsWith(tmpdir() + '/') ||
    relative(root, absolute) === '' ||
    !relative(root, absolute).startsWith('..') ||
    !absolute.startsWith(join(tmpdir(), 'arcnexus-op-')) ||
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    realpathSync(absolute) !== absolute ||
    [record.source, record.workspace].some(
      (location) => location && (within(location, absolute) || within(absolute, location)),
    )
  )
    throw new Error('Operation scratch identity is unsafe');
  return { path: absolute, device: stat.dev, inode: stat.ino };
}

/** Rejects changed paths and aliases before deletion so a replacement directory is never reclaimed. */
function validateScratchIdentity(
  root: string,
  record: ScratchRecord,
  value: ScratchIdentity,
): void {
  if (value.ownerPid <= 1 || !/^\d+$/.test(value.ownerStart) || value.id.length < 16)
    throw new Error('Operation scratch ownership identity is invalid');
  for (const resource of [value.temporary, value.configuration]) {
    const expected =
      resource === value.temporary
        ? String(record.operationTemporaryRoot)
        : String(record.operationTemporaryRoot) + '-configuration';
    if (resource.path !== resolve(expected)) throw new Error('Operation scratch path changed');
    if (!existsSync(resource.path)) continue;
    const stat = lstatSync(resource.path);
    identity(root, record, resource.path);
    if (stat.dev !== resource.device || stat.ino !== resource.inode)
      throw new Error('Operation scratch resource identity changed');
  }
}

/** Removes only the captured directory inode and tolerates an already completed partial cleanup. */
function remove(resource: ResourceIdentity): void {
  if (!existsSync(resource.path)) return;
  const stat = lstatSync(resource.path);
  if (stat.isSymbolicLink() || stat.dev !== resource.device || stat.ino !== resource.inode)
    throw new Error('Operation scratch resource identity changed');
  rmSync(resource.path, { recursive: true });
}

/** Distinguishes a path from its ancestor without accepting sibling prefixes. */
function within(path: string, parent: string): boolean {
  const suffix = relative(path, parent);
  return suffix === '' || (!suffix.startsWith('../') && suffix !== '..' && !suffix.startsWith('/'));
}
