import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** @typedef {{resolved: string, integrity: string, os?: string[], cpu?: string[]}} LockedPackage */

/** Prepares locked packages with bounded connections, then installs offline under confinement. */
class DependencyInstaller {
  /** Validates every source before downloading and leaves lifecycle hooks inside the supervised install. */
  run() {
    /** @type {{lockfileVersion: number, packages: Record<string, LockedPackage>}} */
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    if (lock.lockfileVersion !== 3 || !lock.packages)
      throw new Error('Expected a version-three package lock');
    const packages = Object.entries(lock.packages)
      .filter(([path]) => path !== '')
      .map(([, entry]) => this.package(entry));
    const urls = new Set(packages.filter((entry) => this.applicable(entry)).map((p) => p.resolved));
    if (urls.size)
      this.npm(['cache', 'add', ...urls, '--maxsockets=1', '--ignore-scripts', '--prefer-offline']);
    this.npm(['ci', '--offline', '--no-audit', '--no-fund']);
  }

  /** Refuses local, mutable or authenticated sources before creating any package cache entries.
   * @param {LockedPackage} entry
   */
  package(entry) {
    if (typeof entry.resolved !== 'string' || typeof entry.integrity !== 'string')
      throw new Error('Locked dependency requires a resolved URL and integrity');
    const url = new URL(entry.resolved);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error('Locked dependency requires an unauthenticated HTTPS artifact');
    return entry;
  }

  /** Skips packages npm cannot install on this machine without discarding portable lockfile authority.
   * @param {LockedPackage} entry
   */
  applicable(entry) {
    return this.matches(entry.os, process.platform) && this.matches(entry.cpu, process.arch);
  }

  /** Implements positive and negative platform lists used by npm lockfile package metadata.
   * @param {string[] | undefined} values
   * @param {string} current
   */
  matches(values, current) {
    if (values === undefined) return true;
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'string'))
      throw new Error('Invalid locked dependency platform selector');
    if (values.includes('!' + current)) return false;
    const allowed = values.filter((value) => !value.startsWith('!'));
    return allowed.length === 0 || allowed.includes(current) || allowed.includes('any');
  }

  /** Runs fixed argv without a shell and stops immediately on an observed dependency failure.
   * @param {string[]} args
   */
  npm(args) {
    const result = spawnSync('npm', args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Dependency preparation failed (${result.status})`);
  }
}

new DependencyInstaller().run();
