import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises consolidated validation through the assembled CLI without starting engineering. */
class ValidationFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-validation-'));

  /** Captures a fully owned minimal catalog with no optional guidance files. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.git('init', '-q');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    this.put('architecture/environment.json', {
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
    const common = { schemaVersion: 5, purpose: 'Validate bounded architecture' };
    this.put('architecture/components/platform.json', {
      ...common,
      id: 'platform',
      type: 'platform',
      role: 'engineer',
      executionProfile: 'luna',
      reads: ['.'],
    });
    this.put('architecture/components/package.json', {
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
    this.put('architecture/components/owner.json', {
      schemaVersion: 5,
      purpose: 'Maintain architecture and guidance',
      id: 'owner',
      type: 'foundation',
      parentId: 'package',
      owns: [
        'architecture/environment.json',
        'architecture/roles',
        'architecture/execution-profiles',
        'architecture/components/platform.json',
        'architecture/components/package.json',
        '.agents',
        'AGENTS.md',
      ],
    });
  }

  /** Supplies the inherited role and model policy used by static resolution. */
  private profiles(): void {
    this.put('architecture/roles/engineer.json', {
      schemaVersion: 3,
      id: 'engineer',
      purpose: 'Validate',
      responsibilities: ['Check'],
      activities: ['research'],
    });
    this.put('architecture/execution-profiles/luna.json', {
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
  git(...args: string[]): void {
    const result = spawnSync('git', ['-C', this.root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
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

test('architecture validation accepts absent optional guidance and distinguishes its source', (t) => {
  const fixture = new ValidationFixture(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.guidance.status, 'valid');
  assert.equal(report.guidance.source, 'working-tree');
  assert.deepEqual(report.guidance.skills, []);
  assert.equal(report.status, 'valid');
});

test('architecture validation rejects tracked malformed guidance without executing agents', (t) => {
  const fixture = new ValidationFixture(t);
  fixture.put('.agents/skills/example/SKILL.md', '# Missing metadata');
  fixture.git('add', '.agents');
  const result = fixture.run();
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'invalid');
  assert.equal(report.guidance.diagnostics[0].code, 'invalid_skill');
  assert.equal(report.validation, 'static');
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
