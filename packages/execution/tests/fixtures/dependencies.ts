import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { git } from '../../src/git.js';
import { CheckCacheFixture, fixtureOperation } from './check-cache.js';

/** Supply real locked tarballs without a registry, network or ambient package cache. */
export class DependencyFixture extends CheckCacheFixture {
  /** Give each candidate its own dependency version and a hostile lifecycle script. */
  constructor(t: TestContext) {
    super(t);
    this.update('1.0.0');
    this.restart({
      ...fixtureOperation,
      command: '/usr/bin/node',
      args: ['-e', dependencyProbe],
    });
    const ambient = join(this.source, 'node_modules/sample');
    mkdirSync(ambient, { recursive: true });
    writeFileSync(join(ambient, 'package.json'), '{"version":"ambient"}');
  }

  /** Change actual dependency inputs, keeping all writes in this explicit test fixture. */
  update(version: string) {
    const root = this.task.worktree!;
    const source = join(this.base, `package-${version}`, 'package');
    mkdirSync(source, { recursive: true });
    const data = {
      name: 'sample',
      version,
      scripts: { postinstall: "node -e \"require('fs').writeFileSync('script-ran','bad')\"" },
    };
    writeFileSync(join(source, 'package.json'), JSON.stringify(data));
    const name = `sample-${version}.tgz`;
    execFileSync('tar', ['-czf', join(root, name), '-C', join(source, '..'), 'package']);
    this.manifests(version, name);
    this.commitCandidate();
  }

  /** Preserve a valid manifest alongside an intentionally inconsistent lockfile. */
  mismatch() {
    const root = this.task.worktree!;
    const file = join(root, 'package.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    manifest.dependencies.sample = '99.0.0';
    writeFileSync(file, JSON.stringify(manifest));
    this.commitCandidate();
  }

  /** Assert that install scripts and npm never changed the maintained candidate inputs. */
  unchanged() {
    return (
      !git(this.task.worktree!, 'status', '--porcelain', '--untracked-files=all') &&
      !existsSync(join(this.task.worktree!, 'node_modules'))
    );
  }

  /** Declare a complete npm v3 lock for the local fixture tarball. */
  private manifests(version: string, file: string) {
    const root = this.task.worktree!;
    const dependencies = { sample: `file:${file}` };
    const manifest = { name: 'candidate', version: '1.0.0', dependencies };
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    const integrity =
      'sha512-' +
      createHash('sha512')
        .update(readFileSync(join(root, file)))
        .digest('base64');
    const packages = {
      '': manifest,
      'node_modules/sample': {
        version,
        resolved: `file:${file}`,
        integrity,
        hasInstallScript: true,
      },
    };
    writeFileSync(
      join(root, 'package-lock.json'),
      JSON.stringify({ name: 'candidate', lockfileVersion: 3, packages }),
    );
  }

  /** Commit explicit fixture changes without touching the original source installation. */
  private commitCandidate() {
    git(this.task.worktree!, 'add', '-A');
    git(
      this.task.worktree!,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'Dependency fixture',
    );
  }
}

const dependencyProbe = `
const fs = require('node:fs');
const path = require('node:path');
const entry = require.resolve('sample/package.json');
if (fs.existsSync(path.join(path.dirname(entry), 'script-ran'))) throw new Error('Lifecycle script ran');
try { fs.writeFileSync(entry, 'unconfined'); throw new Error('Dependencies are writable'); }
catch (error) { if (error.code !== 'EROFS') throw error; }
console.log(require('sample/package.json').version);
`;
