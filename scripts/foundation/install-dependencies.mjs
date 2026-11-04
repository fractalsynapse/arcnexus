import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** @typedef {{resolved: string, integrity: string, os?: string[], cpu?: string[]}} LockedPackage */

/** Prepares locked packages sequentially, then installs offline under the caller's confinement. */
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
    const artifacts = [...urls];
    // Chunk argv and temporary disk usage. curl transfers the URLs in each chunk serially.
    for (let i = 0; i < artifacts.length; i += 64) this.cache(artifacts.slice(i, i + 64));
    this.command('npm', ['ci', '--offline', '--no-audit', '--no-fund']);
  }

  /** Downloads to private storage and lets npm ingest local archives without another registry request.
   * @param {string[]} urls
   */
  cache(urls) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-locked-'));
    const archives = urls.map((url, index) => ({ url, path: join(directory, index + '.tgz') }));
    try {
      const transfers = archives.flatMap(({ url, path }) => ['--url', url, '--output', path]);
      this.command('curl', [
        '--disable',
        '--silent',
        '--show-error',
        '--fail-early',
        '--fail',
        '--globoff',
        '--location',
        '--proto',
        '=https',
        '--proto-redir',
        '=https',
        ...transfers,
      ]);
      this.command('npm', [
        'cache',
        'add',
        '--offline',
        '--ignore-scripts',
        ...archives.map(({ path }) => path),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
   * @param {string} executable
   * @param {string[]} args
   */
  command(executable, args) {
    const result = spawnSync(executable, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Dependency preparation failed (${result.status})`);
  }
}

new DependencyInstaller().run();
