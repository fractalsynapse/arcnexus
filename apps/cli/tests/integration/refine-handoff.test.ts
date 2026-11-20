import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('refine passes the exact requested total through the built CLI to the admitted lifecycle', (t) => {
  for (const [args, total] of [
    [['refine'], '1'],
    [['--json', 'refine', '--rounds', '9007199254740992'], '9007199254740992'],
    [['refine', '--rounds', '9007199254740993', '--json'], '9007199254740993'],
    [['refine', '--rounds', '1' + '0'.repeat(310), '--json'], '1' + '0'.repeat(310)],
  ] as Array<[string[], string]>) {
    assertTotal(t, args, total);
  }
});
