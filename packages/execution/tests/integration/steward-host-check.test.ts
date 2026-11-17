import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSteward } from '../../src/steward-response.js';

/** Exercise the exact boundary between steward operations and scheduled host checks. */
class HostCheckScenario {
  private static readonly hostCheck = 'repository-format';

  /** Preserve only authorized steward operations after a redundant host declaration. */
  static run() {
    const reply = {
      kind: 'completed',
      edits: [],
      checks: [
        { id: this.hostCheck, expected: 'pass' },
        { id: 'owner-tests', expected: 'pass' },
      ],
    };
    const decode = (host: string[]) => decodeSteward(reply, ['owner-tests'], undefined, host);
    assert.deepEqual(decode([this.hostCheck]), {
      ...reply,
      checks: [{ id: 'owner-tests', expected: 'pass' }],
    });
    assert.throws(() => decode([]), /repository-format is unavailable/);
    reply.checks[0]!.expected = 'fail';
    assert.throws(() => decode([this.hostCheck]), /repository-format is unavailable/);
  }
}

test('an already scheduled host check cannot abort or extend the steward operation list', () =>
  HostCheckScenario.run());
