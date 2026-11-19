import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { release } from 'node:os';
import { checkCommand, checkEnvironment, type CheckResult } from './check.js';
import { git } from './git.js';
import type { HostTask } from './index.js';
import type { StewardScope } from './steward-check.js';

export interface CheckObservation {
  check?: CheckResult;
  scope?: StewardScope;
  checkInput?: string;
}

/** Validate the captured command before identifying a clean, reproducible check input. */
export function checkInput(task: HostTask, id: string, scope?: StewardScope) {
  const worktree = task.worktree!;
  const command = checkCommand(task.capture, worktree, id, scope?.owner);
  const revision = cleanRevision(worktree);
  if (!revision) return;
  const input = {
    revision,
    authority: task.capture.source.revision,
    id,
    operation: task.capture.operations[id],
    args: command.args,
    cwd: relative(worktree, command.cwd),
    scope: [scope?.owner, scope?.activity, scope?.expected ?? 'pass'],
    environment: environmentIdentity(task, command.executable, command.cwd),
  };
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** Reuse only a satisfied observation whose recorded input identity and immutable log match. */
export function reusableCheck(events: readonly unknown[], input?: string, expected = 'pass') {
  if (!input) return;
  const latest = (events as readonly CheckObservation[]).findLast(
    ({ checkInput }) => checkInput === input,
  )?.check;
  if (
    latest &&
    typeof latest.status === 'number' &&
    (latest.status === 0) === (expected === 'pass') &&
    existsSync(latest.log)
  )
    return latest;
}

/** Ignore setup-event names; identify actual committed inputs and refuse uncertain dirty state. */
function cleanRevision(worktree: string) {
  try {
    if (git(worktree, 'status', '--porcelain', '--untracked-files=all', '--ignored')) return;
    return git(worktree, 'rev-parse', 'HEAD');
  } catch {
    return;
  }
}

/** Include the confined environment, installed dependencies and relevant host tool identities. */
function environmentIdentity(task: HostTask, executable: string, cwd: string) {
  const file = executable.includes('/')
    ? resolve(cwd, executable)
    : checkEnvironment.PATH.split(':')
        .map((path) => join(path, executable))
        .find(existsSync);
  const local = file && (file === task.worktree || file.startsWith(task.worktree! + sep));
  const lock = join(task.capture.source.root, 'node_modules', '.package-lock.json');
  return {
    node: process.versions,
    kernel: release(),
    confinement: checkEnvironment,
    executable: local ? relative(task.worktree!, file!) : fileIdentity(file),
    nodeExecutable: fileIdentity(process.execPath),
    sandbox: fileIdentity('/usr/bin/bwrap'),
    dependencies: existsSync(lock)
      ? createHash('sha256').update(readFileSync(lock)).digest('hex')
      : null,
  };
}

/** Detect replacement of a host executable without retaining executable bytes or environment secrets. */
function fileIdentity(file?: string) {
  if (!file || !isAbsolute(file) || !existsSync(file)) return null;
  const path = realpathSync(file);
  const { dev, ino, size, mtimeMs } = statSync(path);
  return { path, dev, ino, size, mtimeMs };
}
