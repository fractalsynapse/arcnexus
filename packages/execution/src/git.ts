import { execFileSync } from 'node:child_process';
import { isTransientReadFailure } from '../../collaboration/src/index.js';

/** Read or update local Git state without hooks or caller-selected index overrides. */
export function git(root: string, ...args: string[]) {
  return invoke(root, args);
}

/** Read an exact tracked preimage without removing significant trailing source bytes. */
export function gitSource(root: string, revision: string, path: string) {
  return invoke(root, ['show', `${revision}:${path}`], false);
}

/** Retry transient staging reads without an application time or attempt ceiling. */
export function remoteRead(root: string, ...args: string[]) {
  while (true) {
    try {
      return invoke(root, args);
    } catch (error) {
      if (!isTransientReadFailure(error)) throw error;
    }
  }
}

/** Keep Git execution settings common while retaining complete command output. */
function invoke(root: string, args: string[], trim = true) {
  const command = '/usr/bin/git';
  const parameters = ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args];
  const output = execFileSync(command, parameters, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: Infinity,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return trim ? output.trimEnd() : output;
}

/** Compare the current prepared tree to the captured staging base without external diff tools. */
export function candidateDiff(worktree: string, base: string) {
  return git(worktree, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--binary', base);
}
