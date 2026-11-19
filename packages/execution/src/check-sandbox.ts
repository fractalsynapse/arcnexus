import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Expose system binaries and staged inputs without writable source or host credentials. */
export function checkMounts(
  worktree: string,
  common: string,
  dependencies?: string,
  writable = false,
) {
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
  if (dependencies && existsSync(dependencies))
    args.push(writable ? '--bind' : '--ro-bind', dependencies, join(worktree, 'node_modules'));
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
