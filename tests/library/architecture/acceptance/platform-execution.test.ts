import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { captureInitialization } from '../../../../dist/library/architecture/initialization.js';
import { ComponentFixture, selectedActivities } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises the platform as the only authored source of new execution defaults. */
class PlatformExecutionScenarios {
  /** Rejects mixed executable families before either public mode can create a host. */
  legacyEnvironment(t: TestContext): void {
    const fixture = this.fixture(t);
    const path = 'architecture/environment.json';
    const current = JSON.parse(readFileSync(join(fixture.root, path), 'utf8'));
    fixture.put(path, {
      ...current,
      schemaVersion: 3,
      prerequisites: [],
      setup: [{ command: 'node', args: ['--version'] }],
      generatedDirectories: [],
    });
    fixture.commit();
    assert.throws(
      () => new ExecutionContext().resolve(fixture.root),
      /shared architecture environment definition/i,
    );
    this.assertStartupRejected(fixture.root, /shared architecture environment definition/i);
    assert.equal(fixture.run('validate').status, 0);
  }

  /** Checks both option-free entry points without allowing a stalled host to hang qualification. */
  private assertStartupRejected(root: string, diagnostic: RegExp): void {
    for (const args of [
      ['task', 'run', 'Inspect purpose'],
      ['workday', 'start'],
    ]) {
      const result = spawnSync(process.execPath, [resolve('dist/cli.js'), ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ARCNEXUS_STATE_DIR: root + '-state' },
        timeout: 15_000,
      });
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, diagnostic);
    }
  }

  /** Resolves prompt/workday defaults and director identity without a second execution file. */
  singleSource(t: TestContext): void {
    const fixture = this.fixture(t);
    const context = new ExecutionContext().resolve(join(fixture.root, 'package'));
    assert.equal(context.packageId, 'package');
    assert.equal(context.directorProfile, 'director');
    assert.equal(context.directorComponent, 'maintenance');
    assert.equal(context.reviewerProfile, 'director');
    const snapshot = captureInitialization(context.catalog, context.catalog.components.sample!);
    assert.equal(snapshot.componentId, 'maintenance');
    assert.equal(snapshot.profile.id, 'director');
    assert.equal(snapshot.model, 'configured-director-model');
    assert.equal(snapshot.provenance, 'declared-component');
  }

  /** The declared director can assess another package without gaining its engineering eligibility. */
  directorAuthority(t: TestContext): void {
    const fixture = this.operational(t);
    const execution = new ExecutionContext();
    const context = execution.resolve(join(fixture.root, 'package'));
    assert.ok(!context.owners.includes('maintenance'));
    const value = {
      schemaVersion: 3 as const,
      kind: 'research' as const,
      objective: 'Inspect goal',
      expectedOutcome: 'Evidence',
      acceptanceCriteria: ['Evidence'],
      hostChecks: [],
    };
    const director = execution.assignment(context, 'maintenance', value, 'director');
    assert.equal(director.componentId, 'maintenance');
    assert.equal(director.executionProfile.model, 'configured-director-model');
    assert.throws(
      () => execution.assignment(context, 'maintenance', value, 'luna'),
      /outside captured package/,
    );
    assert.throws(
      () => execution.assignment(context, 'maintenance', { ...value, kind: 'change' }, 'director'),
      /outside captured package/,
    );
    const change = execution.assignment(context, 'sample', { ...value, kind: 'change' });
    assert.equal(change.context.at(-1)?.schemaVersion, 6);
    assert.equal(change.executionProfile.id, 'luna');
    assert.deepEqual(change.context.at(-1)?.access.writeDirectories, []);
    assert.equal(execution.assignment(context, 'sample', value).executionProfile.id, 'luna');
  }

  /** Adds one shared finite verification declaration for executable read-only assignments. */
  private operational(t: TestContext): ComponentFixture {
    const fixture = this.fixture(t);
    const path = 'architecture/components/platform.json';
    fixture.put(path, {
      ...JSON.parse(readFileSync(join(fixture.root, path), 'utf8')),
      operations: { check: ['verify'] },
    });
    fixture.put(
      'architecture/components/operations.json',
      fixture.component('operations', 'library', {
        parentId: 'maintenance-package',
        owns: ['architecture/operations'],
      }),
    );
    fixture.put('architecture/operations/check.json', this.verification());
    fixture.commit();
    return fixture;
  }

  /** Defines one finite command shared by all captured read-only owners. */
  private verification() {
    return {
      schemaVersion: 4,
      id: 'check',
      purpose: 'Captured check',
      repository: 'sample',
      kind: 'command',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      cwd: '.',
      category: 'unit-test',
      prerequisites: [],
      generatedDirectories: [],
      artifacts: [],
    };
  }

  /** Rejects retired duplicate execution files rather than silently choosing one source. */
  duplicate(t: TestContext): void {
    const fixture = this.fixture(t);
    fixture.put('architecture/execution.json', {
      directorProfile: 'luna',
      reviewerProfile: 'luna',
    });
    fixture.put(
      'architecture/components/old-execution-owner.json',
      fixture.component('old-execution-owner', 'library', {
        parentId: 'maintenance-package',
        owns: ['architecture/execution.json'],
      }),
    );
    fixture.commit();
    assert.throws(
      () => new ExecutionContext().resolve(fixture.root),
      /Retired execution configuration/,
    );
  }

  /** Missing execution requirements never trigger implicit model or initializer selection. */
  missing(t: TestContext): void {
    const fixture = new ComponentFixture(t);
    fixture.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    assert.throws(() => new ExecutionContext().resolve(fixture.root), /director.*reviewer/i);
  }

  /** Supplies explicit director/reviewer profiles once on the platform and leaves the leaf minimal. */
  private fixture(t: TestContext): ComponentFixture {
    const fixture = new ComponentFixture(t);
    fixture.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    fixture.put(
      'architecture/components/platform.json',
      fixture.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        activities: selectedActivities('luna'),
        director: { component: 'maintenance', profile: 'director' },
        reviewerProfile: 'director',
        defaultPackage: 'maintenance-package',
        verificationInputs: ['architecture'],
      }),
    );
    fixture.put('architecture/execution-profiles/director.json', {
      schemaVersion: 3,
      id: 'director',
      model: 'configured-director-model',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['unit-test'],
    });
    fixture.commit();
    return fixture;
  }
}

const scenarios = new PlatformExecutionScenarios();

test('minimal host startup rejects legacy environment execution recipes', (t) =>
  scenarios.legacyEnvironment(t));

test('execution resolves platform defaults and captured director profile', (t) =>
  scenarios.singleSource(t));

test('execution rejects duplicate retired configuration', (t) => scenarios.duplicate(t));

test('execution requires explicit director and reviewer configuration', (t) =>
  scenarios.missing(t));

test('declared director assessment preserves package engineering boundaries', (t) =>
  scenarios.directorAuthority(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
