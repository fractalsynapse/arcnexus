import { execFileSync } from 'node:child_process';
import type { GuidanceSource } from '../../manager/src/index.js';

export interface ProjectSource extends GuidanceSource {
  readonly root: string;
  readonly revision: string;
  readonly remote: string;
}

/** Open a fixed Git tree without consulting the worktree or contacting the remote. */
export function openProject(directory: string, requested = 'HEAD'): ProjectSource {
  const root = git(directory, 'rev-parse', '--show-toplevel').trim();
  const revision = git(
    root,
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${requested}^{commit}`,
  ).trim();
  const remote = git(root, 'config', '--get', 'remote.origin.url').trim();
  const paths = Object.freeze(
    git(root, 'ls-tree', '-rz', '--name-only', revision).split('\0').filter(Boolean),
  );
  const byPath = new Set(paths);
  return Object.freeze({
    root,
    revision,
    remote,
    paths,
    /** Read an exact repository-relative path from the captured commit. */
    read(path: string) {
      if (!byPath.has(path)) throw new Error(`Missing from captured project: ${path}`);
      return git(root, 'show', `${revision}:${path}`);
    },
  });
}

/** Run a local read and expose failures without leaking command output or credentials. */
function git(directory: string, ...args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });
  } catch {
    throw new Error(`Cannot read Git project (${args[0]} ${args[1] ?? ''}) from ${directory}`);
  }
}
