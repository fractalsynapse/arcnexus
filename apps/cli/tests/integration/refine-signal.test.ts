import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Interrupt the built gateway as soon as its real foreground phase becomes visible. */
async function interrupt(fixture: RoundConsumptionFixture) {
  const child = spawn(process.execPath, [cli, 'refine', '--json'], {
    cwd: fixture.root,
    env: { ...process.env, XDG_STATE_HOME: fixture.storage },
  });
  let output = '';
  let signalled = false;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    output += chunk;
    if (!signalled && output.includes('Refinement round 1/1 · Plan')) {
      signalled = true;
      child.kill('SIGINT');
    }
  });
  const status = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  assert.ok(signalled, output);
  return { status, output };
}

/** Decode complete typed records from the gateway output. */
function records(output: string) {
  return output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('SIGINT preserves the refinement identity for the next built-process invocation', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  const interrupted = await interrupt(fixture);
  assert.equal(interrupted.status, 130, interrupted.output);
  const first = records(interrupted.output);
  const cursor = first.find((record) => record.observation?.refinement)?.observation.refinement;
  assert.ok(cursor, interrupted.output);
  assert.equal(first.filter((record) => record.type === 'result').length, 1);
  const retried = spawnSync(process.execPath, [cli, 'refine', '--json'], {
    cwd: fixture.root,
    env: { ...process.env, XDG_STATE_HOME: fixture.storage },
    encoding: 'utf8',
  });
  assert.equal(retried.status, 1, retried.stderr);
  const resumed = records(retried.stdout);
  const next = resumed.find((record) => record.observation?.refinement)?.observation.refinement;
  assert.equal(next.invocation, cursor.invocation);
  assert.equal(next.phase, 'Plan');
  assert.equal(resumed.at(-1).outcome.kind, 'blocked');
  assert.equal(resumed.filter((record) => record.type === 'result').length, 1);
});
