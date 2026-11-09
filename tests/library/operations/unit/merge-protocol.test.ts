import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { integrateAssembled } from '../../../../dist/library/operations/merge-protocol.js';
import type { MergeAdapter } from '../../../../dist/library/operations/merge-protocol.js';
import type { CheckResult } from '../../../../dist/library/operations/check-result.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** One verification outcome, replayed by the fake adapter so the protocol is the thing under test. */
function check(
  status: 'passed' | 'failed',
  evidence: string[] = ['candidate', 'reviewer'],
): CheckResult {
  return { status, evidence, artifacts: [] };
}

/**
 * Drives the merge protocol with a recording adapter.
 *
 * The protocol's value is its ordering, so it is tested directly with a provider that logs every
 * hook instead of through a real Git repository or remote.
 */
class ProtocolFixture {
  readonly calls: string[] = [];

  readonly effect = {
    id: 'merge-1',
    environmentId: 'sim',
    runId: 'run',
    operation: 'pull-request.merge',
    target: 'repo',
    definitionDigest: 'policy',
    input: { deliveryId: 'delivery', targetHead: 'base-1' },
    inputDigest: 'input',
    status: 'prepared',
    attempt: 1,
  } as unknown as ExternalEffect;

  result = check('passed');

  target = 'base-1';

  /** Moves the observed target after the first observation, as a concurrent push would. */
  moveAfterFirstGate = false;

  authorize = 0;

  /** Returns an adapter whose hooks all record their call, with an optional failure path. */
  adapter(t: TestContext): MergeAdapter {
    t.after(() => undefined);
    return {
      gates: async () => {
        this.calls.push('gates');
        if (this.moveAfterFirstGate && this.calls.length > 1) return { base: 'moved-midway' };
        return { base: this.target };
      },
      began: () => {
        this.calls.push('began');
      },
      assemble: async () => {
        this.calls.push('assemble');
        return 'assembled-1';
      },
      progressed: () => this.calls.push('progressed'),
      refused: () => {
        this.calls.push('refused');
        return { merged: false, reason: 'Assembled merge failed current verification' };
      },
      integrate: async (_item, assembled) => {
        this.calls.push('integrate');
        return { merged: true, head: assembled };
      },
    };
  }

  /** Runs the protocol against the recording adapter. */
  async run(t: TestContext): Promise<Record<string, unknown>> {
    return integrateAssembled(
      this.adapter(t),
      this.effect,
      async () => this.result,
      () => {
        this.authorize++;
      },
      new AbortController().signal,
    );
  }
}

test('merge protocol verifies the assembled tree before moving anything', async (t) => {
  const f = new ProtocolFixture();
  const result = await f.run(t);
  assert.equal(result.merged, true);
  assert.equal((result.verification as CheckResult).status, 'passed');
  assert.deepEqual(
    f.calls,
    ['gates', 'began', 'assemble', 'progressed', 'gates', 'integrate'],
    'the target is re-observed between verification and integration',
  );
  assert.equal(f.authorize, 1, 'authorization is asserted immediately before the swap');
});

test('a failed assembled check refuses without integrating and keeps the pass on record', async (t) => {
  const f = new ProtocolFixture();
  f.result = check('failed');
  const result = await f.run(t);
  assert.equal(result.merged, false);
  assert.ok(!f.calls.includes('integrate'), 'nothing moves when the assembled tree fails');
  assert.deepEqual(f.calls, ['gates', 'began', 'assemble', 'refused']);
});

test('a target that moved before assembly is refused before any work begins', async (t) => {
  const f = new ProtocolFixture();
  f.target = 'moved-by-someone-else';
  await assert.rejects(() => f.run(t), /target changed before assembly/i);
  assert.deepEqual(f.calls, ['gates']);
});

test('a target that moved during verification stops the integration', async (t) => {
  const f = new ProtocolFixture();
  f.moveAfterFirstGate = true;
  await assert.rejects(() => f.run(t), /target changed during verification/i);
  assert.deepEqual(f.calls, ['gates', 'began', 'assemble', 'progressed', 'gates']);
  assert.ok(!f.calls.includes('integrate'), 'the swap never happens against a moved target');
});

test('verification with no evidence is an error, never a silent pass', async (t) => {
  const f = new ProtocolFixture();
  f.result = { status: 'passed', evidence: [], artifacts: [] };
  await assert.rejects(() => f.run(t), /no verification evidence/);
  assert.ok(!f.calls.includes('integrate'));
});

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic'] });
