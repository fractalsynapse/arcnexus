import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { catalogFixture, componentFields, containerFields } from './catalog-fixture.js';

/** Builds a real catalog and a tiny Node profile without invoking inference. */
export class ComponentTestFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-tests-'));

  readonly state = join(this.root, 'state');

  readonly repo = join(this.root, 'repo');

  /** Creates a tracked catalog with unit and regression suites and registers temporary cleanup. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    mkdirSync(this.repo);
    this.git('init', '-b', 'main');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    // The fixture catalog declares a primary repository, so the checkout must actually have that
    // origin: otherwise binding identity fails with git's raw 'No such remote' error and hides the
    // behaviour every scenario in this family is meant to exercise.
    if (!this.git('remote').trim().split('\n').includes('origin'))
      this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    catalogFixture(this.repo);
    this.maintenanceOwner();
    this.catalog();
    this.profile();
    this.put('.gitignore', '.test-build/\nprepared\n');
    this.suite('unit', 'small', ['fast', 'deterministic']);
    this.suite('regression', 'boundary', ['deterministic'], 'integration');
    this.commit();
  }

  /**
   * One maintenance owner for the shared documents this fixture authors.
   *
   * Every tracked file must resolve to exactly one owner, and containers own nothing - so the
   * environment document, the role and profile directories, the operation definitions, the test
   * profile and the two container definitions all need a maintenance component. Without one the
   * catalog refuses to load and each suite in this family fails in setup rather than on its subject;
   * the same single-maintainer rule the repository uses for `architecture-maintenance`.
   */
  private maintenanceOwner(): void {
    this.put('architecture/components/maintenance.yaml', {
      ...this.fields(),
      id: 'maintenance',
      type: 'foundation',
      parentId: 'package',
      owns: [
        '.gitignore',
        'architecture/environment.yaml',
        'architecture/roles',
        'architecture/execution-profiles',
        'architecture/test-profiles',
        'architecture/operations',
        'architecture/components/platform.yaml',
        'architecture/components/package.yaml',
      ],
    });
  }

  /** Builds shared version-four fixture component fields with explicit owned test roots. */
  private fields() {
    const base = {
      ...componentFields,
      purpose: 'Test owner',
      objectives: [],
      constraints: [],
    };
    return base;
  }

  /** Writes sample ownership, profile references and tracked fixture tests. */
  private catalog(): void {
    const fields = this.fields();
    this.containers();
    this.put('architecture/components/sample.yaml', {
      ...fields,
      id: 'sample',
      type: 'library',
      parentId: 'package',
      owns: ['tests'],
      testProfile: 'node',
      // Preparation and the runner are host lifecycle steps: setup compiles, verify runs the
      // selected suites. Neither is an agent operation, so neither needs an activity binding.
      operations: { compile: ['setup'], suites: ['verify'] },
    });
    this.put('architecture/environment.yaml', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
  }

  /** Defines platform and package containment without granting blanket source ownership. */
  private containers(): void {
    this.put('architecture/components/platform.yaml', {
      ...containerFields,
      id: 'platform',
      type: 'platform',
      executionProfile: 'luna',
      reads: ['.'],
      defaultPackage: 'package',
      verificationInputs: [],
    });
    this.put('architecture/components/package.yaml', {
      ...containerFields,
      // The primary repository is derived for a platform, while a package names the repository whose
      // sources it contains; the shared container base therefore carries it only for the package.
      repository: 'sample',
      id: 'package',
      type: 'package',
      parentId: 'platform',
      root: '.',
    });
  }

  /** Declares the shared Node preparation and compiled-test runner once. */
  profile(overrides: Record<string, unknown> = {}): void {
    this.put('architecture/test-profiles/node.yaml', {
      schemaVersion: 2,
      id: 'node',
      adapter: 'node',
      outputRoot: '.test-build',
      preparation: [{ operation: 'compile', purpose: 'tests' }],
      run: 'suites',
      ...overrides,
    });
    this.runnerOperations();
  }

  /** Declares the setup and verify operations the shared profile references. */
  private runnerOperations(): void {
    this.runnerOperation('compile', 'Compile the fixture suites', ['build.cjs'], []);
    this.runnerOperation(
      'suites',
      'Run the selected fixture suites',
      ['--test', { context: 'selectedTestFiles' }],
      ['compile'],
    );
  }

  /** Writes one finite fixture operation with the shared repository, category and output contract. */
  private runnerOperation(
    id: string,
    purpose: string,
    args: unknown[],
    prerequisites: string[],
  ): void {
    this.put(`architecture/operations/${id}.yaml`, {
      schemaVersion: 4,
      id,
      purpose,
      kind: 'command',
      repository: 'sample',
      cwd: '.',
      category: 'unit-test',
      command: 'node',
      args,
      generatedDirectories: ['.test-build'],
      artifacts: [],
      prerequisites,
      network: false,
    });
  }

  /** Reads literal suite metadata and maps the source to its compiled test artifact. */
  suite(category: string, name: string, tags: string[], level = category): void {
    this.put(
      `tests/${category}/${name}.test.ts`,
      `import {test} from 'node:test';\nfunction registerSuite(value) {}\nregisterSuite(${JSON.stringify({ component: 'sample', level, tags })});\ntest('${name}',()=>{});\n`,
    );
  }

  /** Creates parent directories and writes the fixture configuration or source file. */
  put(path: string, value: unknown): void {
    mkdirSync(dirname(join(this.repo, path)), { recursive: true });
    writeFileSync(join(this.repo, path), typeof value === 'string' ? value : JSON.stringify(value));
  }

  /** Stages fixture files and commits the revision that the built CLI will capture. */
  commit(): void {
    this.git('add', '.');
    this.git('commit', '-m', 'fixture');
  }

  /** Runs Git against the fixture repository and propagates command failures. */
  git(...args: string[]): string {
    const result = spawnSync('git', ['-C', this.repo, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }

  /** Adds an unselected profile to verify irrelevant configuration does not alter execution. */
  unusedProfile(): void {
    const path = 'architecture/components/sample.yaml';
    const sample = JSON.parse(readFileSync(join(this.repo, path), 'utf8'));
    sample.ownership.paths = ['tests/unit', 'tests/regression'];
    sample.discovery.tests = sample.ownership.paths;
    sample.access.writeDirectories = sample.ownership.paths;
    this.put(path, sample);
    this.put('architecture/components/other.yaml', {
      ...sample,
      id: 'other',
      testProfile: 'other',
      owns: ['tests/other'],
    });
    this.otherProfile();
    this.commit();
  }

  /** Adds another owner profile to exercise preparation and runner compatibility. */
  private otherProfile(): void {
    this.put('architecture/test-profiles/other.yaml', {
      schemaVersion: 2,
      id: 'other',
      adapter: 'node',
      outputRoot: '.test-build',
      preparation: [
        { command: process.execPath, args: ['-e', 'process.exit(9)'], purpose: 'tests' },
      ],
    });
    this.put(
      'tests/other/unit/other.test.ts',
      "function registerSuite(value) {}\nregisterSuite({component:'other',level:'unit',tags:['slow']});",
    );
  }

  /** Resolves a captured assignment for test-selection immutability assertions. */
  assignment(): any {
    const result = spawnSync(
      process.execPath,
      [
        resolve('dist/cli.js'),
        'inspect',
        'sample',
        'Improve tests',
        '--project',
        this.repo,
        '--json',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  run(...args: string[]) {
    return spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'test', ...args, '--project', this.repo, '--json'],
      { encoding: 'utf8', env: { ...process.env, ARCNEXUS_STATE_DIR: this.state } },
    );
  }
}
