import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { check, checkCommand, ownerTestInapplicability, type CheckResult } from './check.js';
import { checkInput, reusableCheck } from './check-cache.js';
import { CheckDependencies } from './dependencies.js';
import type { HostTask } from './index.js';
import type { StewardScope } from './steward-check.js';

/** Validate authority, prepare actual inputs, then reuse or execute the same declared check. */
export async function runCheck(
  task: HostTask,
  id: string,
  signal: AbortSignal,
  scope?: StewardScope<string>,
) {
  signal.throwIfAborted();
  const worktree = task.worktree;
  if (!worktree) throw new Error('No task worktree is available for checks');
  checkCommand(task.capture, worktree, id, scope?.owner, scope?.activity);
  const applicable = !ownerTestInapplicability(task.capture, worktree, id, scope?.owner);
  const environment =
    applicable && existsSync(join(worktree, 'package.json'))
      ? new CheckDependencies(task)
      : undefined;
  const failure = await environment?.prepare(signal);
  if (failure) return prerequisiteFailure(task, id, failure, scope);
  const dependencies = environment?.directory;
  const input = checkInput(task, id, scope, dependencies);
  const reused = reusableCheck(task.observations(), input);
  if (reused) {
    task.note({ check: reused, scope, checkInput: input, reusedFrom: reused.log });
    return reused;
  }
  return executeCheck(task, id, signal, scope, input, dependencies);
}

/** Report the actual prerequisite command and ensure it cannot satisfy an expected failing test. */
function prerequisiteFailure(
  task: HostTask,
  id: string,
  failure: CheckResult,
  scope?: StewardScope<string>,
): CheckResult {
  const result: CheckResult = {
    ...failure,
    id,
    prerequisite: 'dependencies',
    reason: `Dependency prerequisite failed; requested check ${id} did not run. See ${failure.log}`,
  };
  task.note({ check: result, scope });
  return result;
}

/** Record only checks that actually reached their declared command. */
async function executeCheck(
  task: HostTask,
  id: string,
  signal: AbortSignal,
  scope?: StewardScope<string>,
  input?: string,
  dependencies?: string,
) {
  const log = task.artifact(`${id}.log`);
  const result = await check(
    task.capture,
    task.worktree!,
    task.config.common,
    id,
    scope?.owner,
    log,
    signal,
    dependencies,
    scope?.activity,
  );
  task.note({ check: result, scope, checkInput: input });
  return result;
}
