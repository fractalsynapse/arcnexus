import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment } from '../architecture/config.js';
import { git } from '../operations/process.js';

/**
 * Verifies that a candidate workspace holds nothing it was not told to produce.
 *
 * Pass `inPlace` for a run whose workspace is the operator's own checkout. Two of these assertions
 * describe a candidate: nothing should be dirty before a candidate starts, and every ignored path
 * should be a declared generated directory. An in-place run delivers nothing, and its tree legitimately
 * contains operator artifacts the environment never declares — editor state, build caches, session test
 * materializations. The authority that still binds it is unchanged: the stance guard at run creation
 * and the ownership scope enforced when each edit is applied.
 */
export function assertOutputs(workspace: string, env: Environment, inPlace = false): void {
  if (!inPlace && git(workspace, 'status', '--porcelain', '--untracked-files=all').trim())
    throw new Error('Workspace contains changed source or untracked files');
  assertGeneratedOutputs(workspace, env, inPlace);
}

export function assertGeneratedOutputs(workspace: string, env: Environment, inPlace = false): void {
  if (inPlace) return;
  const ignored = git(workspace, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z')
    .split('\0')
    .filter(Boolean);
  for (const path of ignored)
    if (
      !env.generatedDirectories.some((dir) => path.startsWith(`${dir}/`)) &&
      !env.workspace?.dependencies.some((m) => path === m.path || path.startsWith(m.path + '/'))
    )
      throw new Error(`Unknown ignored output: ${path}`);
  for (const path of env.generatedDirectories) {
    const segments = path.split('/');
    for (let i = 1; i <= segments.length; i++) {
      const p = join(workspace, ...segments.slice(0, i));
      if (existsSync(p) && lstatSync(p).isSymbolicLink())
        throw new Error(`Generated directory is a symlink: ${path}`);
    }
  }
}
