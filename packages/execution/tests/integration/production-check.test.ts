import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ProductionCheckFixture } from '../fixtures/production-check.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['native', 'regression'] } as const;

test('production HostTask.check executes declared success and failure in real confinement', async (t) => {
  const fixture = new ProductionCheckFixture(t);
  const task = await fixture.open(t);
  fixture.diagnose(task);
  const scope = { owner: 'work', activity: 'testing', expected: 'pass' } as const;
  const signal = new AbortController().signal;
  const passed = await task.check('fixture-check', signal, scope);
  const failed = await task.check('failing-check', signal, scope);
  const results = [passed, failed].map((result) => ({
    ...result, text: readFileSync(result.log, 'utf8'),
  }));
  const observations = task.observations<{ checkInput?: string; check?: unknown }>()
    .filter(({ check }) => check);
  console.log(JSON.stringify({ productionCheckObservation: { results, observations } }));
  assert.equal(passed.status, 0, JSON.stringify(results));
  assert.equal(failed.status, 37, JSON.stringify(results));
  assert.deepEqual(results.map(({ id, command, args, cwd }) => ({ id, command, args, cwd })), [
    { id: 'fixture-check', command: '/usr/bin/node', args: ['command.mjs', 'success'],
      cwd: join(task.worktree!, 'nested') },
    { id: 'failing-check', command: '/usr/bin/node', args: ['command.mjs', 'failure'],
      cwd: join(task.worktree!, 'nested') },
  ]);
  assert(observations.every(({ checkInput }) => /^[a-f0-9]{64}$/.test(checkInput ?? '')));
  assert.equal(observations.length, 2);
  assert.deepEqual(JSON.parse(results[0]!.text), {
    phase: 'success', baseline: 'durable evidence\n', cwd: join(task.worktree!, 'nested'),
  });
  assert(results[1]!.text.includes('"phase":"failure"'));
  assert(results[1]!.text.includes('Declared command failure\n  complete café detail\n'));
  assert.equal(existsSync(join(task.worktree!, 'nested/overlay.txt')), false);
  assert.equal(readFileSync(join(task.worktree!, 'baseline'), 'utf8'), 'durable evidence\n');
});
