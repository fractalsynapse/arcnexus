import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import {
  cli,
  minimalWorkflowFixture as workflowFixture,
} from '../../testing/support/workflow-fixture.js';

/** Exercises initialization behavior through observable scenarios. */
class InitializationTests {
  /** Verifies that declared direction initializes exactly once with captured profile provenance. */
  declaredRun(t: TestContext): void {
    const fixture = workflowFixture(t);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.initialization.result.status, 'ready');
    assert.equal(record.initialization.provenance, 'declared-component');
    assert.equal(record.initialization.model, 'gpt-6-luna');
    assert.equal(record.initialization.reasoning, 'medium');
    assert.equal(record.initialization.turns, 1);
    assert.notEqual(record.initialization.threadId, record.threadId);
    assert.equal(record.implementationAttempts, 1);
  }

  /** Verifies that refuses invalid initialization. */
  refusesInvalidInitialization(t: TestContext, mode: string): void {
    const fixture = workflowFixture(t);
    fixture.configure({ initializerMode: mode });
    const result = fixture.run();
    assert.equal(result.status, 1, result.stderr);
    assert.equal(existsSync(fixture.calls), false, 'No worker inference');
    const record = JSON.parse(result.stdout);
    assert.ok(record.initialization);
    assert.match(result.stderr, /initializer|initialization|director/i);
  }

  /** Verifies that initializer loop retains needs_attention without dispatching a worker. */
  loopNeedsAttention(t: TestContext): void {
    const fixture = workflowFixture(t);
    fixture.configure({ initializerMode: 'loop' });
    const result = fixture.run();
    assert.equal(result.status, 1, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.status, 'needs_attention');
    assert.equal(existsSync(fixture.calls), false);
    const child = JSON.parse(
      readFileSync(join(fixture.state, 'runs', record.initialization.runId, 'report.json'), 'utf8'),
    );
    assert.equal(child.status, 'needs_attention');
    assert.match(
      readFileSync(join(fixture.state, 'runs', child.id, 'events.jsonl'), 'utf8'),
      /Tool unavailable/,
    );
  }

  /** Verifies that director profile is independent of the worker. */
  modelOverride(t: TestContext): void {
    const fixture = workflowFixture(t);
    this.director(fixture, 'maintenance', 'astra');
    const profile = JSON.parse(
      readFileSync(join(fixture.repo, '.arc/architecture/execution-profiles/luna.yaml'), 'utf8'),
    );
    writeFileSync(
      join(fixture.repo, '.arc/architecture/execution-profiles/astra.yaml'),
      JSON.stringify({ ...profile, id: 'astra', model: 'gpt-6-astra' }),
    );
    fixture.commit();
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.initialization.model, 'gpt-6-astra');
    assert.equal(record.resolvedAssignment.executionProfile.model, 'gpt-6-luna');
  }

  /** Verifies that declared read only container. */
  declaredReadOnlyContainer(t: TestContext): void {
    const fixture = workflowFixture(t);
    this.director(fixture, 'sample', 'luna');
    fixture.commit();
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.initialization.provenance, 'declared-component');
    assert.equal(record.initialization.componentId, 'sample');
    assert.equal(record.initialization.turns, 1);
  }

  /** Updates only the platform's authoritative director configuration. */
  private director(
    fixture: ReturnType<typeof workflowFixture>,
    component: string,
    profile: string,
  ): void {
    const path = join(fixture.repo, '.arc/architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    platform.director = { component, profile };
    writeFileSync(path, JSON.stringify(platform));
  }

  /** Verifies that minimal platform with reviewer requires declared director. */
  missingDeclaration(t: TestContext): void {
    const fixture = workflowFixture(t);
    const path = join(fixture.repo, '.arc/architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    delete platform.director;
    writeFileSync(path, JSON.stringify(platform));
    fixture.commit();
    const result = spawnSync(process.execPath, [cli, 'validate', '--project', fixture.repo], {
      encoding: 'utf8',
      timeout: 30 * 60 * 1000,
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /initializer|initialization|director/i);
  }
}

const suite = new InitializationTests();

test('declared direction initializes exactly once with captured profile provenance', (t) =>
  suite.declaredRun(t));

test('minimal platform with reviewer requires declared director', (t) =>
  suite.missingDeclaration(t));

for (const mode of ['write', 'widen', 'question'])
  test('initializer stops downstream inference: ' + mode, (t) =>
    suite.refusesInvalidInitialization(t, mode),
  );

test('director profile is independent of the worker', (t) => suite.modelOverride(t));

test('declared director works beneath a minimal containment-only platform', (t) =>
  suite.declaredReadOnlyContainer(t));

test('initializer loop retains needs_attention without dispatching a worker', (t) =>
  suite.loopNeedsAttention(t));

registerSuite({
  component: 'task-intake',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
