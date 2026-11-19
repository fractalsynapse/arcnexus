import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { release } from 'node:os';
import {
  assertCapturedOwnership,
  checkCommand,
  checkEnvironment,
  type CheckResult,
} from './check.js';
import {
  qualityOperationAvailable,
  qualityRuntime,
  selectQualityInputs,
} from '../../foundation/src/index.js';
import type { HostTask } from './index.js';
import type { StewardScope } from './steward-check.js';
import { git } from './git.js';

export interface CheckObservation {
  check?: CheckResult;
  scope?: StewardScope;
  checkInput?: string;
}

/** Validate captured authority and bind a check to its current candidate inputs. */
export async function checkInput(task: HostTask, id: string, scope?: StewardScope) {
  const worktree = task.worktree!;
  assertOwnerAuthority(task, scope, worktree);
  const command = checkCommand(task.capture, worktree, id, scope?.owner);
  const operation = task.capture.operations[id];
  const selection = await qualitySelection(task, operation, scope, worktree, id);
  if (selection && !selection.reuseEligibility.eligible) return;
  const inputs = selection?.identity ?? cleanRevision(worktree);
  if (!inputs) return;
  return checkIdentity(task, id, scope, command, operation, selection, inputs, worktree);
}

/** Reject candidate ownership changes before resolving owner-scoped checks. */
function assertOwnerAuthority(task: HostTask, scope: StewardScope | undefined, worktree: string) {
  const hasCapturedComponents = (task.capture.source.paths ?? []).some((path) =>
    path.startsWith('.arc/architecture/components/'),
  );
  if (scope?.owner && hasCapturedComponents) assertCapturedOwnership(task.capture, worktree);
}

/** Resolve explicit-root inputs only for captured owner quality operations. */
async function qualitySelection(
  task: HostTask,
  operation: HostTask['capture']['operations'][string] | undefined,
  scope: StewardScope | undefined,
  worktree: string,
  id: string,
) {
  const applicability = operation?.applicability;
  const ownerQuality =
    applicability === 'owner-lint-files' || applicability === 'owner-format-files';
  if (!scope?.owner || !ownerQuality) return;
  assertQualityAvailable(task, operation, applicability, id);
  return selectQualityInputs(
    applicability === 'owner-lint-files' ? 'lint' : 'format:check',
    scope.owner,
    worktree,
  );
}

/** Fail closed when a captured owner quality runtime is unavailable. */
function assertQualityAvailable(
  task: HostTask,
  operation: HostTask['capture']['operations'][string] | undefined,
  applicability: string,
  id: string,
) {
  if (
    !qualityOperationAvailable({
      tool: operation?.tool ?? '',
      command: operation?.command ?? '',
      args: operation?.args ?? [],
      applicability,
      source: task.capture.source,
    })
  )
    throw new Error(`Unavailable owner quality operation: ${id}`);
}

/** Hash the operation, scope, environment and current selected inputs together. */
function checkIdentity(
  task: HostTask,
  id: string,
  scope: StewardScope | undefined,
  command: ReturnType<typeof checkCommand>,
  operation: HostTask['capture']['operations'][string] | undefined,
  selection: Awaited<ReturnType<typeof selectQualityInputs>> | undefined,
  inputs: string,
  worktree: string,
) {
  const input = {
    revision: inputs,
    authority: task.capture.source.revision,
    id,
    operation,
    args: command.args,
    cwd: relative(worktree, command.cwd),
    scope: [scope?.owner, scope?.activity, scope?.expected ?? 'pass'],
    environment: environmentIdentity(task, command.executable, command.cwd),
    qualityTool: selection
      ? {
          runtime: qualityRuntime(selection.operation),
          executable: fileIdentity(
            join(worktree, 'node_modules/.bin', qualityRuntime(selection.operation).executable),
          ),
        }
      : undefined,
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
