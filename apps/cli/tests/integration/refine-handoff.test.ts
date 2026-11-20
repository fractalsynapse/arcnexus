import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Assert a real foreground invocation reaches its pending provider gate with the exact total. */
function assertTotal(t: import('node:test').TestContext, args: string[], total: string) {
  const fixture = new RoundConsumptionFixture(t);
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: fixture.root,
    env: { ...process.env, XDG_STATE_HOME: fixture.storage },
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stderr);
  if (!args.includes('--json')) {
    assert.match(result.stdout, /Refinement round 1\/1 · Plan/);
    return;
  }
  const records = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const progress = records.find((record) => record.type === 'progress');
  assert.equal(progress.observation.message, 'Refinement round 1/' + total + ' · Plan');
  assert.equal(records.filter((record) => record.type === 'result').length, 1);
  assert.equal(records.at(-1).outcome.kind, 'blocked');
}

for (const [args, total] of [
  [['refine'], '1'],
  [['--json', 'refine', '--rounds', '9007199254740992'], '9007199254740992'],
  [['refine', '--rounds', '9007199254740993', '--json'], '9007199254740993'],
  [['refine', '--rounds', '1' + '0'.repeat(310), '--json'], '1' + '0'.repeat(310)],
] as Array<[string[], string]>) {
  test('built refinement preserves requested total ' + total, (t) => assertTotal(t, args, total));
}
