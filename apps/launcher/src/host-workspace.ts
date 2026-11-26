import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HostAssignment } from './host-assignment.js';

function git(cwd: string, ...args: string[]) {
  return execFileSync('/usr/bin/git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: Infinity,
    env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, GIT_CONFIG_NOSYSTEM: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Copy verified committed bytes to a dedicated, replaceable Host checkout. */
export function provisionHostCheckout(
  config: HostAssignment,
  verifyDirectory: (path: string) => void,
) {
  if (!config.source || existsSync(config.checkout)) return;
  verifyDirectory(config.source);
  if (git(config.source, 'config', '--get', 'remote.origin.url') !== config.remote)
    throw new Error('Host checkout source differs from its captured repository');
  const parent = dirname(config.checkout);
  verifyDirectory(parent);
  const scratch = mkdtempSync(join(parent, '.arc-checkout-'));
  try {
    const target = join(scratch, 'checkout');
    git(scratch, 'clone', '--no-hardlinks', '--no-checkout', '--', config.source, target);
    git(target, 'remote', 'set-url', 'origin', config.remote);
    if (config.documentationOnly) git(target, 'update-ref', '--no-deref', 'HEAD', config.revision);
    else git(target, 'checkout', '--detach', config.revision);
    renameSync(target, config.checkout);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
