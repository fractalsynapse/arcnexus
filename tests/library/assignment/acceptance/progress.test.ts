import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture as workflowFixture } from '../../testing/support/workflow-fixture.js';
import { minimalOperationFixture as operationFixture } from '../../testing/support/operations-fixture.js';

/** Exercises progress behavior through observable scenarios. */
class ProgressTests {
  /** Verifies that repeated exposed SDK command failures stop the stream with retained raw events. */
  observedShell(t: TestContext): void {
    const fixture = workflowFixture(t);
    fixture.configure({ observedShellFailures: 4 });
    const result = fixture.run();
    assert.equal(result.status, 1, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'needs_attention');
    const events = readFileSync(join(fixture.state, 'runs', record.id, 'events.jsonl'), 'utf8');
    assert.match(events, /repeat-failing-check/);
  }

  /** Verifies that repeated unverified implementation cycles stop with retained corrective work. */
  repeatedCheckpoints(t: TestContext): void {
    const fixture = workflowFixture(t, 'exhaust');
    const result = fixture.run();
    assert.equal(result.status, 1, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'needs_attention');
    assert.equal(record.implementationAttempts, 4);
  }

  /** Verifies that observable repeated failures diagnose a loop then stop unchanged dispatch. */
  repeatedFailures(t: TestContext): void {
    const fixture = operationFixture(t);
    fixture.configure({ operationRepeats: 4 });
    const result = fixture.run();
    assert.equal(result.status, 1, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'needs_attention');
    assert.equal(record.operations.length, 3, 'fourth unchanged action must not execute');
    const events = readFileSync(join(fixture.state, 'runs', record.id, 'timeline.jsonl'), 'utf8');
    assert.match(events, /progress.loop_warning/);
    assert.match(events, /progress.needs_attention/);
  }
}

const suite = new ProgressTests();

test('observable repeated failures diagnose a loop then stop unchanged dispatch', (t) =>
  suite.repeatedFailures(t));

test('repeated unverified implementation cycles stop with retained corrective work', (t) =>
  suite.repeatedCheckpoints(t));

test('repeated exposed SDK command failures stop the stream with retained raw events', (t) =>
  suite.observedShell(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
