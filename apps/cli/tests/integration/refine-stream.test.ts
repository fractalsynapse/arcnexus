import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;
const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Run the actual gateway with explicit provider answers and retain live output. */
class StreamScenario {
  readonly fixture: RoundConsumptionFixture;

  /** Permit no-change answers without inventing an approval for a proposal. */
  constructor(t: import('node:test').TestContext) {
    this.fixture = new RoundConsumptionFixture(t);
    const executable = this.fixture.install('stream');
    const source = readFileSync(executable, 'utf8');
    assert.ok(source.includes('if (!this.task.assignment.clarifications?.length)'));
    writeFileSync(
      executable,
      source.replace('if (!this.task.assignment.clarifications?.length)', 'if (false)'),
    );
  }

  /** Retain complete JSONL records as they arrive and mark records seen before termination. */
  async run(json: boolean) {
    const child = spawn(
      process.execPath,
      [cli, 'refine', '--rounds', '2', ...(json ? ['--json'] : [])],
      {
        cwd: this.fixture.root,
        env: { ...process.env, XDG_STATE_HOME: this.fixture.storage },
      },
    );
    let output = '';
    let partial = '';
    const streamed: Array<Record<string, any>> = [];
    let liveProvider = false;
    let liveToolResult = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      partial += chunk;
      const lines = partial.split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) {
        const record = JSON.parse(line) as Record<string, any>;
        streamed.push(record);
        if (record.type !== 'event') continue;
        const event = record.detail?.event;
        if (event?.type === 'fixture.consumption') {
          liveProvider = child.exitCode === null;
        }
        if (event?.type === 'item.completed' && event.item?.type === 'mcp_tool_call') {
          liveToolResult = child.exitCode === null;
        }
      }
    });
    const status = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    return { status, output, streamed, liveProvider, liveToolResult };
  }
}

/** Require each phase to be named in the public progress stream. */
function assertPhases(records: Array<{ type: string; observation?: { message: string } }>) {
  const progress = records
    .filter((record) => record.type === 'progress')
    .map((record) => record.observation?.message);
  for (const phase of [
    '1/2 · Plan',
    '1/2 · Architect',
    '1/2 · Run',
    '2/2 · Plan',
    '2/2 · Architect',
    '2/2 · Run',
  ])
    assert.ok(
      progress.some((message) => message?.includes('Refinement round ' + phase)),
      phase,
    );
}

test('built refinement streams complete ordered JSONL through the production composition', async (t) => {
  const result = await new StreamScenario(t).run(true);
  assert.equal(result.status, 0, result.output);
  assert.ok(result.liveProvider, 'complete provider observation arrives before process completion');
  assert.ok(result.liveToolResult, 'complete tool result arrives before process completion');
  const records = result.output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assertPhases(records);
  const provider = records.filter((record) => record.detail?.event?.type === 'fixture.consumption');
  assert.deepEqual(
    provider.map((record) => record.detail.event.component),
    ['planner', 'architecture', 'direction', 'planner', 'architecture', 'direction'],
  );
  for (const record of provider) {
    assert.deepEqual(Object.keys(record.detail.event).sort(), [
      'component',
      'consumption',
      'executable',
      'input',
      'reads',
      'type',
    ]);
    assert.ok(record.detail.event.input.startsWith('## Actor and project\n'));
    assert.deepEqual(record.detail.event.consumption, []);
    assert.deepEqual(record.detail.event.reads, []);
    assert.match(record.detail.event.executable, /stream-provider/);
  }
  const toolResults = records
    .map((record) => record.detail?.event)
    .filter((event) => event?.type === 'item.completed' && event.item?.type === 'mcp_tool_call');
  assert.ok(toolResults.length > 0);
  assert.ok(toolResults.every((event) => event.item.result !== undefined));
  assert.ok(
    records.some(
      (record) =>
        record.type === 'measurements' &&
        record.measurements.profiles.some(
          (profile: { usage: { input_tokens: { reported: number | null } } }) =>
            profile.usage.input_tokens.reported !== null,
        ),
    ),
  );
  assert.equal(records.filter((record) => record.type === 'result').length, 1);
  assert.equal(records.at(-1).outcome.kind, 'planned');
});

test('built refinement identifies round and phase in live human output', async (t) => {
  const result = await new StreamScenario(t).run(false);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Refinement round 1\/2 · Plan/);
  assert.match(result.output, /Refinement round 2\/2 · Architect/);
  assert.match(result.output, /Refinement round 2\/2 · Run/);
});
