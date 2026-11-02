import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { TestContext } from 'node:test';
import { ComponentV5Fixture } from './component-v5-fixture.js';

/** Supplies fully owned historical declarations with explicit execution policy for real CLI migration. */
export class MigrationFixture extends ComponentV5Fixture {
  /** Replaces fixture declarations with a complete executable v4 family before capturing authority. */
  constructor(t: TestContext) {
    super(t);
    t.after(() => rmSync(this.root + '-state', { recursive: true, force: true }));
    for (const file of ['unrelated-filename', 'maintenance-package'])
      rmSync(join(this.root, 'architecture/components/' + file + '.json'));
    this.containment();
    this.ownership();
    this.put('architecture/execution.json', {
      directorProfile: 'luna',
      reviewerProfile: 'luna',
      defaultPackage: 'package',
      verificationInputs: [],
    });
    const path = 'architecture/execution-profiles/luna.json';
    const profile = JSON.parse(readFileSync(join(this.root, path), 'utf8'));
    profile.operationCategories = ['cli-check', 'unit-test', 'build'];
    this.put(path, profile);
    this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.commit();
  }

  /** Records container context without assigning containers descendant writes. */
  private containment(): void {
    this.put(
      'architecture/components/platform.json',
      this.legacy('platform', 'platform', {
        initialization: { schemaVersion: 3, componentId: 'maintenance' },
      }),
    );
    this.put(
      'architecture/components/package.json',
      this.legacy('package', 'package', {
        parentId: 'platform',
        repository: 'sample',
        repositoryRoot: '.',
      }),
    );
  }

  /** Gives configuration and implementation exactly one accountable owner, including definition files. */
  private ownership(): void {
    const configuration = [
      'architecture/environment.json',
      'architecture/execution.json',
      'architecture/roles',
      'architecture/execution-profiles',
      'architecture/operations',
      'architecture/components/platform.json',
      'architecture/components/package.json',
      'architecture/components/maintenance.json',
    ];
    this.put('architecture/components/maintenance.json', this.leaf('maintenance', configuration));
    const sample = this.leaf('sample', ['package', 'architecture/components/sample.json']);
    sample.ownership.publicModules = ['package/src/value.ts'];
    sample.discovery = {
      source: ['package/src'],
      documentation: ['package/docs'],
      tests: ['package/tests'],
      exclude: [],
    };
    this.put('architecture/components/sample.json', sample);
  }

  /** Declares historical directory granularity separately from the exact authority being preserved. */
  private leaf(id: string, paths: string[]): any {
    return this.legacy(id, 'library', {
      parentId: 'package',
      access: { readPaths: ['.'], writeDirectories: ['.'] },
      ownership: {
        paths,
        publicModules: [],
        directoryExceptions: [{ path: '.', reason: 'Historical directory granularity' }],
      },
    });
  }

  /** Provides required historical fields without introducing time or operation quotas. */
  private legacy(id: string, type: string, extra: object): any {
    return {
      schemaVersion: 4,
      id,
      type,
      purpose: 'Preserve owned behavior',
      path: '.',
      objectives: [],
      constraints: [],
      questions: [],
      interfaces: [],
      relatedIds: [],
      role: 'engineer',
      executionProfile: 'luna',
      access: { readPaths: ['.'], writeDirectories: [] },
      verification: [{ command: 'node', args: ['-e', 'process.exit(0)'] }],
      operationIds: [],
      patternIds: [],
      provides: [],
      consumes: [],
      ...extra,
    };
  }

  /** Exercises the public no-options command from inside the project rather than an injected service. */
  migrate(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), 'config', 'migrate', ...args], {
      cwd: this.root,
      encoding: 'utf8',
      timeout: 30 * 60 * 1000,
      env: {
        ...process.env,
        ARCNEXUS_STATE_DIR: this.root + '-state',
      },
    });
  }
}
