import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { CheckResult } from '../../src/check.js';
import { ProductionCheckFixture } from '../fixtures/production-check.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['native', 'regression'],
} as const;

// The admitted HostTask is the real caller boundary. Exact payloads reject synthetic exits,
// altered argv/cwd/inputs and a command that never ran. Overlay assertions reject escaping writes.
// Raw namespace probes isolate setup failure; their nonzero exits cannot satisfy capability.
// No native-disable switch applies to this required characterization.
test('production HostTask.check executes declared success and failure in real confinement', async (t) => {
  const fixture = new ProductionCheckFixture(t);
  const task = await fixture.open(t);
  fixture.diagnose(task);
  const scope = { owner: 'work', activity: 'testing', expected: 'pass' } as const;
  const signal = new AbortController().signal;
  const passed = await task.check('fixture-check', signal, scope);
  const failed = await task.check('failing-check', signal, scope);
  const results = [passed, failed].map((result) => ({
    ...result,
    text: readFileSync(result.log, 'utf8'),
  }));
  const observations = task
    .observations<{ checkInput?: string; check?: unknown }>()
    .filter(({ check }) => check);
  console.log(JSON.stringify({ productionCheckObservation: { results, observations } }));
  assert.equal(passed.status, 0, JSON.stringify(results));
  assert.equal(failed.status, 37, JSON.stringify(results));
  assert.equal(observations.length, 2);
  assert(observations.every(({ checkInput }) => /^[a-f0-9]{64}$/.test(checkInput ?? '')));
  assert.notEqual(observations[0]!.checkInput, observations[1]!.checkInput);
  assertCommands(results, join(task.worktree!, 'nested'));
  assert.equal(existsSync(join(task.worktree!, 'nested/overlay.txt')), false);
  assert.equal(readFileSync(join(task.worktree!, 'baseline'), 'utf8'), 'durable evidence\n');
});

/** Require exact captured command metadata and both actual payloads, including complete failure text. */
function assertCommands(results: Array<CheckResult & { text: string }>, cwd: string) {
  assert.deepEqual(
    results.map(({ id, command, args, cwd }) => ({ id, command, args, cwd })),
    [
      { id: 'fixture-check', command: '/usr/bin/node', args: ['command.mjs', 'success'], cwd },
      { id: 'failing-check', command: '/usr/bin/node', args: ['command.mjs', 'failure'], cwd },
    ],
  );
  for (const [index, phase] of ['success', 'failure'].entries()) {
    const line = results[index]!.text.split('\n').find((line) => line.startsWith('{"phase":'));
    assert(line, results[index]!.text);
    assert.deepEqual(JSON.parse(line), { phase, baseline: 'durable evidence\n', cwd });
  }
  assert(results[1]!.text.includes('Declared command failure\n  complete café detail\n'));
}
