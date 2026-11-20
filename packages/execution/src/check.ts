import { writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { team } from '../../team/src/index.js';
import { resolveOperation, type Capture } from '../../architecture/src/index.js';
import { hasOwnerTestSuites } from '../../foundation/src/index.js';
import { execute } from './process.js';
import { checkMounts } from './check-sandbox.js';
import { qualityObservation } from './quality-observation.js';
import type { QualityScope } from '../../foundation/src/index.js';
export { checkEnvironment } from './check-sandbox.js';

export interface CheckResult {
  id: string;
  status: number | null | 'not-applicable';
  reason?: string;
  diagnostic?: string;
  selection?: QualityScope;
  prerequisite?: 'dependencies';
  command: string;
  args: string[];
  cwd: string;
  durationMs: number;
  log: string;
}

/** Record inapplicability or run the captured operation in a networkless overlay. */
export async function check(
  capture: Capture,
  worktree: string,
  common: string,
  id: string,
  owner: string | undefined,
  log: string,
  signal: AbortSignal,
  dependencies = join(capture.source.root, 'node_modules'),
  activity?: string,
): Promise<CheckResult> {
  signal.throwIfAborted();
  const { executable, args, cwd } = checkCommand(capture, worktree, id, owner, activity);
  const parameters = { id, command: executable, args, cwd, log };
  const reason = ownerTestInapplicability(capture, worktree, id, owner);
  if (reason) {
    writeFileSync(log, `Not applicable: ${reason}\n`, { mode: 0o600, flag: 'wx' });
    return { ...parameters, status: 'not-applicable', reason, durationMs: 0 };
  }
  const start = performance.now();
  const sandbox = checkMounts(worktree, common, dependencies);
  const invocation = [...sandbox, '--chdir', cwd, '--', executable, ...args];
  const { status, stdout } = await execute('/usr/bin/bwrap', invocation, {
    cwd: worktree,
    log,
    signal,
  });
  const result = { ...parameters, status, durationMs: Math.round(performance.now() - start) };
  return qualityObservation(capture, worktree, owner, result, stdout);
}

/** Check the captured prerequisite only for optional, owner-scoped operations. */
export function ownerTestInapplicability(
  capture: Capture,
  worktree: string,
  id: string,
  owner?: string,
): string | undefined {
  if (
    !owner ||
    capture.operations[id]?.applicability !== 'owner-test-suites' ||
    capture.project.checks?.acceptance.includes(id)
  )
    return;
  if (!hasOwnerTestSuites(worktree, owner, team.list(capture.components)))
    return `No test suites for ${owner} in the current worktree`;
}

/** Produce formatter stdout in the same disposable, networkless overlay as host checks. */
export async function formatContents(
  root: string,
  directory: string,
  common: string,
  path: string,
  input: string,
  log: string,
  signal: AbortSignal,
) {
  const args = [
    ...checkMounts(directory, common, join(root, 'node_modules')),
    '--chdir',
    directory,
    '--',
    '/usr/bin/node',
    './node_modules/prettier/bin/prettier.cjs',
    `--stdin-filepath=${path}`,
  ];
  const result = await execute('/usr/bin/bwrap', args, { cwd: directory, input, log, signal });
  if (result.status !== 0) throw new Error(`Formatter exited ${result.status}; evidence: ${log}`);
  return result.stdout;
}

/** Resolve a captured operation and owner-dependent arguments in the sealed workspace. */
export function checkCommand(
  capture: Capture,
  worktree: string,
  id: string,
  owner?: string,
  activity?: string,
) {
  const operation = resolveOperation(capture, id, owner, activity);
  if (!operation || !operation.command || operation.network !== false)
    throw new Error(`Unavailable confined operation: ${id}`);
  const args = operation.args;
  const cwd = resolve(worktree, operation.cwd ?? '.');
  if (isAbsolute(operation.cwd ?? '.') || (cwd !== worktree && !cwd.startsWith(worktree + sep)))
    throw new Error(`Operation working directory escapes the worktree: ${id}`);
  return { executable: operation.command, args, cwd, parameters: operation.parameterValues };
}
