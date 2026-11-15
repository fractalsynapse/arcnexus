import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';

/** Exercises consolidated validation through the assembled CLI without starting engineering. */
export class MinimalCatalogFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-validation-'));

  /** Captures a fully owned minimal catalog with no optional guidance files. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.git('init', '-q');
    this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    this.put('.arc/architecture/environment.json', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
    this.catalog();
    this.git('add', '.');
    this.git('commit', '-qm', 'fixture');
  }

  /** Provides inherited execution identity without requiring model execution for validation. */
  private catalog(): void {
    const common = { schemaVersion: 6, purpose: 'Validate bounded architecture' };
    this.put('.arc/architecture/components/platform.json', {
      ...common,
      id: 'platform',
      type: 'platform',
      activities: {
        research: {
          role: 'engineer',
          profile: 'luna',
          instructions: ['Resolve the uncertainty the sample architecture actually depends on'],
          operations: [],
        },
      },
      executionProfile: 'luna',
      reads: ['.'],
    });
    this.put('.arc/architecture/components/package.json', {
      ...common,
      id: 'package',
      type: 'package',
      parentId: 'platform',
    });
    this.owner();
    this.profiles();
  }

  /** Assigns maintained files without repeating implicit definition ownership. */
  private owner(): void {
    this.put('.arc/architecture/components/owner.json', {
      schemaVersion: 6,
      purpose: 'Maintain architecture and guidance',
      id: 'owner',
      type: 'foundation',
      parentId: 'package',
      owns: ['.arc/architecture', '.agents', 'AGENTS.md'],
    });
  }

  /** Supplies the inherited role and model policy used by static resolution. */
  private profiles(): void {
    this.put('.arc/architecture/roles/engineer.json', {
      schemaVersion: 4,
      id: 'engineer',
      purpose: 'Validate',
      responsibilities: ['Check'],
    });
    this.put('.arc/architecture/execution-profiles/luna.json', {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: [],
    });
  }

  /** Writes fixture data without changing the committed architecture baseline. */
  put(path: string, value: unknown): void {
    mkdirSync(join(this.root, path, '..'), { recursive: true });
    writeFileSync(join(this.root, path), typeof value === 'string' ? value : JSON.stringify(value));
  }

  /** Runs Git and reports fixture setup failures immediately. */
  git(...args: string[]): string {
    const result = spawnSync('git', ['-C', this.root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }

  /** Invokes the production command and retains its independently observable exit status. */
  run() {
    return spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'validate', '--project', this.root, '--json'],
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  }
}
