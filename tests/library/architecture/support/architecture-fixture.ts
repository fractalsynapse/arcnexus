import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';

export const cli = resolve('dist/cli.js');

export function fixture(t: TestContext): ArchitectureFixture {
  return new ArchitectureFixture(t);
}

/** Exercises architecture fixture behavior through observable scenarios. */
export class ArchitectureFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'architecture-'));

  readonly repo = join(this.root, 'repo');

  /**
   * Fields a leaf owner declares.
   *
   * Ownership is expressed by `owns`; verification, discovery, access and documentation are derived
   * from the owners and the bound operations, so authoring them is a load failure rather than a
   * shortcut. Containers use containerCommon() instead - sharing this base produced documents that
   * matched no schema branch, and every legitimate key then looked like the offense.
   */
  readonly common = {
    schemaVersion: 6,
    purpose: 'Own sample behavior',
    objectives: [],
    constraints: [],
    questions: [],
    owns: ['src/sample'],
    executionProfile: 'luna',
    activities: {
      research: {
        role: 'engineer',
        profile: 'luna',
        operations: [],
        instructions: ['Establish what the sample component guarantees before changing it'],
      },
    },
  };

  component: any;

  /** Creates a committed legacy catalog fixture and registers temporary repository cleanup. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    mkdirSync(this.repo);
    this.git('init', '-b', 'main');
    // The environment declares a primary repository, so the checkout must carry that origin:
    // binding identity compares the declared URL against it, and without the remote git's raw
    // "No such remote 'origin'" surfaces instead of the behaviour these scenarios exercise.
    if (!this.git('remote').trim().split('\n').includes('origin'))
      this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    this.hierarchy();
    this.execution();
    this.environment();
    writeFileSync(join(this.repo, 'source.txt'), 'before');
    writeFileSync(join(this.repo, 'README.md'), 'Sample');
    writeFileSync(join(this.repo, 'test.mjs'), '');
    this.commit();
  }

  /** Runs Git against the fixture repository and propagates command failures. */
  private git(...args: string[]): string {
    const result = spawnSync('git', ['-C', this.repo, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }

  /** Creates parent directories and writes the fixture configuration or source file. */
  put(path: string, value: unknown): void {
    mkdirSync(join(this.repo, path, '..'), { recursive: true });
    writeFileSync(join(this.repo, path), JSON.stringify(value));
  }

  /** Writes fixture source bytes while creating missing parent directories. */
  source(path: string, content: string): void {
    mkdirSync(join(this.repo, path, '..'), { recursive: true });
    writeFileSync(join(this.repo, path), content);
  }

  /** Stages fixture files and commits the revision that the built CLI will capture. */
  commit(): void {
    this.git('add', '.');
    this.git('commit', '-m', 'fixture');
  }

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  run(...args: string[]) {
    return spawnSync(process.execPath, [cli, ...args, '--project', this.repo], {
      encoding: 'utf8',
      env: { ...process.env, ARCNEXUS_STATE_DIR: join(this.root, 'state') },
    });
  }

  /** Fields a platform or package may declare: containment and roots, never leaf ownership. */
  private containerCommon(id: string, type: string): Record<string, unknown> {
    return {
      schemaVersion: 6,
      id,
      type,
      purpose: `Contain ${id} owners`,
      objectives: [],
      constraints: [],
      questions: [],
      executionProfile: 'luna',
      activities: {},
    };
  }

  /** Defines platform, package and leaf ownership for ancestry acceptance. */
  private hierarchy(): void {
    this.put('architecture/components/platform.json', {
      ...this.containerCommon('platform', 'platform'),
      reads: ['.'],
      director: { component: 'sample', profile: 'luna' },
      reviewerProfile: 'luna',
      defaultPackage: 'package',
      verificationInputs: [],
    });
    this.put('architecture/components/package.json', {
      ...this.containerCommon('package', 'package'),
      parentId: 'platform',
      repository: 'sample',
      root: '.',
    });
    this.component = { ...this.common, id: 'sample', type: 'library', parentId: 'package' };
    this.put('architecture/components/sample.json', this.component);
  }

  /** Declares the fixture engineering role and Luna execution profile. */
  private execution(): void {
    this.put('architecture/roles/engineer.json', {
      schemaVersion: 4,
      id: 'engineer',
      purpose: 'Engineering',
      responsibilities: ['Verify bounded work'],
    });
    this.put('architecture/execution-profiles/luna.yaml', {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'live',
      timeoutSeconds: 900,
      commandTimeoutSeconds: 120,
      maxTurns: 3,
      maxCorrectiveTurns: 2,
    });
  }

  /** Declares an empty preparation environment for catalog-focused scenarios. */
  private environment(): void {
    this.put('architecture/environment.json', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
  }
}
