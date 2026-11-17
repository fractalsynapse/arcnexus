import { execFileSync } from 'node:child_process';

/** Read or update local Git state without hooks or caller-selected index overrides. */
export function git(root: string, ...args: string[]) {
  return invoke(root, args);
}

/** Bound a read-only staging operation and repeat it once if the provider is unreachable. */
export function remoteRead(root: string, ...args: string[]) {
  try {
    return invoke(root, args, true);
  } catch {
    return invoke(root, args, true);
  }
}

/** Keep Git execution settings common to local operations and bounded provider reads. */
function invoke(root: string, args: string[], bounded = false) {
  const command = '/usr/bin/git';
  const parameters = ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args];
  const invocation = bounded ? ['--kill-after=2s', '15s', command, ...parameters] : parameters;
  return execFileSync(bounded ? '/usr/bin/timeout' : command, invocation, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, GIT_CONFIG_NOSYSTEM: '1' },
  }).trimEnd();
}

/** Compare the current prepared tree to the captured staging base without external diff tools. */
export function candidateDiff(worktree: string, base: string) {
  return git(worktree, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--binary', base);
}
