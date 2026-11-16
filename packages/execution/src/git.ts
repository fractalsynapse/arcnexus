import { execFileSync } from 'node:child_process';

/** Read or update local Git state without hooks or caller-selected index overrides. */
export function git(root: string, ...args: string[]) {
  return execFileSync(
    '/usr/bin/git',
    ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, GIT_CONFIG_NOSYSTEM: '1' },
    },
  ).trimEnd();
}
