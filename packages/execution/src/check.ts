import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import type { Capture } from '../../architecture/src/index.js';
import { execute } from './process.js';

export interface CheckResult {
  id: string;
  status: number | null;
  command: string;
  args: string[];
  cwd: string;
  durationMs: number;
  log: string;
}

/** Run a captured operation in a networkless disposable overlay of the worktree. */
export async function check(
  capture: Capture,
  worktree: string,
  common: string,
  id: string,
  owner: string | undefined,
  log: string,
  signal: AbortSignal,
): Promise<CheckResult> {
  const { executable, args, cwd } = command(capture, worktree, id, owner);
  const parameters = { id, command: executable, args, cwd, log };
  const start = performance.now();
  const sandbox = mounts(capture.source.root, worktree, common);
  const invocation = [...sandbox, '--chdir', cwd, '--', executable, ...args];
  const { status } = await execute('/usr/bin/bwrap', invocation, { cwd: worktree, log, signal });
  return { ...parameters, status, durationMs: Math.round(performance.now() - start) };
}

/** Resolve a captured operation and owner-dependent arguments in the sealed workspace. */
function command(capture: Capture, worktree: string, id: string, owner: string | undefined) {
  const operation = Object.hasOwn(capture.operations, id) && capture.operations[id];
  if (!operation || !operation.command || operation.network !== false)
    throw new Error(`Unavailable confined operation: ${id}`);
  const args = (operation.args ?? []).map((arg) => {
    if (typeof arg === 'string') return arg;
    if (!owner || arg.context !== 'owner') throw new Error(`Unresolved operation argument: ${id}`);
    return owner;
  });
  const cwd = resolve(worktree, operation.cwd ?? '.');
  if (isAbsolute(operation.cwd ?? '.') || (cwd !== worktree && !cwd.startsWith(worktree + sep)))
    throw new Error(`Operation working directory escapes the worktree: ${id}`);
  return { executable: operation.command, args, cwd };
}

/** Expose system binaries and staged inputs without writable source or host credentials. */
function mounts(root: string, worktree: string, common: string) {
  const args = [
    ...environment,
    '--overlay-src',
    worktree,
    '--tmp-overlay',
    worktree,
    '--ro-bind',
    common,
    common,
  ];
  const bindings = join(common, 'arcnexus');
  if (existsSync(bindings)) args.push('--tmpfs', bindings);
  const dependencies = join(root, 'node_modules');
  if (existsSync(dependencies))
    args.push('--ro-bind', dependencies, join(worktree, 'node_modules'));
  return args;
}

const environment = [
  '--unshare-all',
  '--die-with-parent',
  '--clearenv',
  '--ro-bind',
  '/usr',
  '/usr',
  '--symlink',
  'usr/lib',
  '/lib',
  '--symlink',
  'usr/lib64',
  '/lib64',
  '--symlink',
  'usr/bin',
  '/bin',
  '--proc',
  '/proc',
  '--dev',
  '/dev',
  '--tmpfs',
  '/tmp',
  '--setenv',
  'PATH',
  '/usr/local/bin:/usr/bin:/bin',
  '--setenv',
  'HOME',
  '/tmp',
  '--setenv',
  'GIT_CONFIG_NOSYSTEM',
  '1',
  '--setenv',
  'GIT_OPTIONAL_LOCKS',
  '0',
];
