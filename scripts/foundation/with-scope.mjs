#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Runs one engineering command where confined execution can create its process scope.
 *
 * Confinement places each supervised command in a child cgroup so cancellation can kill the whole
 * tree. That needs a delegated cgroup subtree: under a caller sandbox that mounts `/sys/fs/cgroup`
 * read-only, the mkdir fails with `EROFS` and every native suite skips itself instead of running.
 * Starting the command as a transient user service obtains that delegation from the user's own
 * manager, so the command needs no elevated approval and no widened filesystem access, and the
 * native suites become observable locally rather than only in CI.
 */
class ScopeRunner {
  /** Replaces this process's command with the requested one, inside a delegated scope when needed. */
  run(args) {
    if (!args.length) throw new Error('Expected with-scope <command> [args…]');
    const [command, ...rest] = args;
    if (this.delegated()) return this.execute(command, rest);
    return this.execute('/usr/bin/systemd-run', [
      ...this.inherited(),
      '--user',
      `--uid=${process.getuid()}`,
      `--gid=${process.getgid()}`,
      '--property=Delegate=yes',
      `--working-directory=${process.cwd()}`,
      '--pipe',
      '--wait',
      '--collect',
      command,
      ...rest,
    ]);
  }

  /**
   * Forwards the caller's environment, because a transient service starts from the manager's
   * environment instead of inheriting the one that asked for the work. Values carrying newlines are
   * left to the service default rather than smuggled through an argument list.
   */
  inherited() {
    return Object.entries(process.env)
      .filter(([, value]) => value !== undefined && !value.includes('\n'))
      .map(([name, value]) => `--setenv=${name}=${value}`);
  }

  /** Reports whether this process can already create a child cgroup, so nothing is nested twice. */
  delegated() {
    const parent = this.scopePath();
    if (!parent) return false;
    const probe = join(parent, 'arcnexus-delegation-probe');
    try {
      mkdirSync(probe);
      return true;
    } catch {
      return false;
    } finally {
      rmSync(probe, { recursive: true, force: true });
    }
  }

  /** Resolves the writable cgroup subtree of this process, or nothing when the layout is unknown. */
  scopePath() {
    const entry = (readCgroupEntry() ?? '').replace(/^0::/, '');
    if (!entry || !entry.endsWith('.scope')) return undefined;
    try {
      return realpathSync(join('/sys/fs/cgroup', entry));
    } catch {
      return undefined;
    }
  }

  /** Runs the command directly, inheriting stdio and reporting only its exit status. */
  execute(command, args) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}

/** Reads this process's cgroup, which names the scope the harness already placed it in. */
function readCgroupEntry() {
  return readFileSync('/proc/self/cgroup', 'utf8')
    .split('\n')
    .find((line) => line.startsWith('0::'));
}

new ScopeRunner().run(process.argv.slice(2));
