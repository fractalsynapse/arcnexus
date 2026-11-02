import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import {
  minimalOperationFixture as operationFixture,
  configureAgentOperation,
} from '../../testing/support/operations-fixture.js';

/** Exercises pending operation behavior through observable scenarios. */
class PendingOperationTests {
  /** Verifies that sDK bridge observes a long operation without timing it out or invoking it twice. */
  waitsWithoutRestart(t: TestContext): void {
    const f = operationFixture(t);
    configureAgentOperation(f, [
      '-e',
      "setTimeout(()=>console.log('Finished after transport observation window'),4100)",
    ]);
    f.commit();
    const result = f.run('--kind', 'research');
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.operationCalls, 1);
    assert.equal(record.operations.length, 1);
    assert.equal(
      readFileSync(join(f.root, 'operations.jsonl.pending'), 'utf8').trim().split('\n').length,
      1,
      'One initial progress response, then wait for completed feedback',
    );
    assert.ok(record.operations[0].durationMs >= 4100);
    assert.match(
      readFileSync(join(f.root, 'operations.jsonl'), 'utf8'),
      /Finished after transport/,
    );
  }
}

const suite = new PendingOperationTests();

test('SDK bridge observes a long operation without timing it out or invoking it twice', (t) =>
  suite.waitsWithoutRestart(t));

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
