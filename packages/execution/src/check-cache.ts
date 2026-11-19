import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { release } from 'node:os';
import { checkCommand, checkEnvironment, type CheckResult } from './check.js';
import { team } from '../../team/src/index.js';
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
  const operation = task.capture.operations[id];
  const ownerScoped = operation?.applicability?.startsWith('owner-');
  const inputs = ownerScoped
    ? ownerQualityInputs(task, id, scope?.owner)
    : cleanRevision(worktree);
  if (!inputs) return;
  const input = {
    revision: inputs,
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

/** Bind owner quality evidence to owned code and operation configuration, excluding unrelated commits. */
function ownerQualityInputs(task: HostTask, id: string, owner?: string) {
  if (!owner || !task.worktree) return;
  const operation = task.capture.operations[id];
  const applicability = operation?.applicability;
  if (applicability !== 'owner-lint-files' && applicability !== 'owner-format-files') return;
  try {
    const entries = git(task.worktree, 'ls-tree', '-r', '--format=%(objectname) %(path)', 'HEAD')
      .split('\n')
      .map((entry) => entry.split(' ', 2) as [string, string]);
    const config = /^(?:\.arc\/architecture\/components\/.*\.yaml|package(?:-lock)?\.json|eslint\.config\.ts|\.eslintignore|\.prettierignore|\.gitignore|packages\/foundation\/(?:src\/index\.ts|scripts\/owner-quality\.ts))$/;
    const source = applicability === 'owner-lint-files'
      ? /\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx)$/
      : /\.(?:ts|mts|cts|js|mjs|cjs|jsx|tsx|json|ya?ml)$/;
    const selected = entries.filter(([, path]) => {
      if (config.test(path)) return true;
      if (!source.test(path)) return false;
      const resolution = team.ownerFor(Object.values(task.capture.components), path);
      if (resolution.kind !== 'owned') throw new Error(`Invalid captured ownership for ${path}`);
      return resolution.owner.id === owner;
    });
    return createHash('sha256').update(JSON.stringify({
      applicability,
      owner,
      selection: selected,
      ownership: Object.values(task.capture.components).map(({ id, owns }) => [id, owns]),
      authority: task.capture.source.revision,
    })).digest('hex');
  } catch {
    return;
  }
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
