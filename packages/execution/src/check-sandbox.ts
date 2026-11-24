import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
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

/** Probe the normal check boundary before a container Host can claim requests. */
export function verifyCheckSandbox(storage: string) {
  const directory = mkdtempSync(join(storage, '.check-sandbox-'));
  try {
    const worktree = join(directory, 'worktree');
    const common = join(directory, 'common');
    const outside = join(directory, 'outside');
    mkdirSync(worktree);
    mkdirSync(common);
    writeFileSync(outside, '');
    execFileSync(
      '/usr/bin/bwrap',
      [
        ...checkMounts(worktree, common),
        '--chdir',
        worktree,
        '--',
        '/usr/bin/sh',
        '-ec',
        probeCheck,
        'sandbox-probe',
        outside,
        readlinkSync('/proc/self/ns/net'),
      ],
      { stdio: 'inherit' },
    );
    if (existsSync(join(worktree, 'probe'))) throw new Error('Sandbox probe modified its worktree');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const probeCheck = [
  'namespace="$(readlink /proc/self/ns/net)"',
  'test -n "$namespace"',
  'test "$namespace" != "$2"',
  'test ! -e "$1"',
  'test -x /usr/bin/unshare',
  'if /usr/bin/unshare --user /usr/bin/true 2>/dev/null; then exit 1; fi',
  'touch probe',
].join('\n');

export const checkEnvironment = Object.freeze({
  PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: '/tmp',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_OPTIONAL_LOCKS: '0',
});

const environment = [
  '--unshare-all',
  '--unshare-user',
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
