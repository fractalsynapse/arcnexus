import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { team } from '../../team/src/index.js';
import type { Capture } from '../../architecture/src/index.js';
import {
  hasOwnerTestSuites,
  qualityOperationAvailable,
  selectQualityInputs,
} from '../../foundation/src/index.js';
import { execute } from './process.js';

export interface CheckResult {
  id: string;
  status: number | null | 'not-applicable';
  reason?: string;
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
): Promise<CheckResult> {
  signal.throwIfAborted();
  const { executable, args, cwd } = checkCommand(capture, worktree, id, owner);
  const parameters = { id, command: executable, args, cwd, log };
  if (owner && !Object.hasOwn(capture.components, owner))
    throw new Error(`Unknown captured owner: ${owner}`);
  if (
    owner &&
    (capture.source.paths ?? []).some((path) => path.startsWith('.arc/architecture/components/'))
  ) assertCapturedOwnership(capture, worktree);
  const reason = await ownerOperationInapplicability(capture, worktree, id, owner);
  if (reason) {
    writeFileSync(log, `Not applicable: ${reason}\n`, { mode: 0o600, flag: 'wx' });
    return { ...parameters, status: 'not-applicable', reason, durationMs: 0 };
  }
  const start = performance.now();
  const sandbox = mounts(capture.source.root, worktree, common);
  const invocation = [...sandbox, '--chdir', cwd, '--', executable, ...args];
  const { status } = await execute('/usr/bin/bwrap', invocation, { cwd: worktree, log, signal });
  return { ...parameters, status, durationMs: Math.round(performance.now() - start) };
}

/** Refuse missing, added or changed ownership declarations against immutable capture. */
export function assertCapturedOwnership(capture: Capture, worktree: string) {
  const admittedPaths = (capture.source.paths ?? []).filter((path) =>
    path.startsWith('.arc/architecture/components/') && path.endsWith('.yaml'),
  ).sort();
  const files = globSync('.arc/architecture/components/*.yaml', { cwd: worktree }).sort();
  if (!admittedPaths.length || JSON.stringify(files) !== JSON.stringify(admittedPaths))
    throw new Error('Candidate ownership drift differs from captured authority');
  for (const path of admittedPaths) {
    if (readFileSync(join(worktree, path), 'utf8') !== capture.source.read(path))
      throw new Error('Candidate ownership drift differs from captured authority');
  }
}

/** Check captured owner applicability before running its operation in the overlay. */
async function ownerOperationInapplicability(
  capture: Capture,
  worktree: string,
  id: string,
  owner?: string,
): Promise<string | undefined> {
  const operation = capture.operations[id];
  const required = capture.project.checks?.acceptance.includes(id);
  if (!owner || required) return;
  if (operation?.applicability === 'owner-test-suites') {
    if (!hasOwnerTestSuites(worktree, owner, team.list(capture.components)))
      return `No test suites for ${owner} in the current worktree`;
    return;
  }
  const applicability = operation?.applicability;
  if (
    !operation ||
    (applicability !== 'owner-lint-files' && applicability !== 'owner-format-files')
  )
    return;
  const selected = await selectQualityInputs(
    applicability === 'owner-lint-files' ? 'lint' : 'format:check',
    owner,
    worktree,
  );
  for (const path of selected.files) {
    const resolution = team.ownerFor(team.list(capture.components), path);
    if (resolution.kind !== 'owned' || resolution.owner.id !== owner)
      throw new Error(`Captured ownership authority does not assign ${path} to ${owner}`);
  }
  if (!selected.files.length)
    return `No ${selected.operation} files for ${owner} in the current worktree`;
  if (!operation.tool || !operation.command)
    throw new Error(`Unavailable owner quality operation: ${id}`);
  if (!qualityOperationAvailable({
    tool: operation.tool,
    command: operation.command,
    args: operation.args ?? [],
    applicability,
  }))
    throw new Error(`Unavailable owner quality operation: ${id}`);
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
    ...mounts(root, directory, common),
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
export function checkCommand(capture: Capture, worktree: string, id: string, owner?: string) {
  const operation = Object.hasOwn(capture.operations, id) && capture.operations[id];
  if (!operation || !operation.command || operation.network !== false)
    throw new Error(`Unavailable confined operation: ${id}`);
  const args = (operation.args ?? []).map((arg) => {
    if (typeof arg === 'string') return arg;
    if (!owner || !arg || arg.context !== 'owner')
      throw new Error(`Unresolved operation argument: ${id}`);
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

export const checkEnvironment = Object.freeze({
  PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: '/tmp',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_OPTIONAL_LOCKS: '0',
});

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
  ...Object.entries(checkEnvironment).flatMap(([name, value]) => ['--setenv', name, value]),
];
