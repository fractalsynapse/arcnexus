import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;
const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

type StreamResult = {
  status: number | null;
  output: string;
  streamed: Array<Record<string, any>>;
  liveProvider: boolean;
  liveToolResult: boolean;
};

/** Run the actual gateway with explicit provider answers and retain live output. */
class StreamScenario {
  readonly fixture: RoundConsumptionFixture;
  readonly release: string;

  /** Permit no-change answers without inventing an approval for a proposal. */
  constructor(t: import('node:test').TestContext) {
    this.fixture = new RoundConsumptionFixture(t);
    this.release = join(this.fixture.root, '.git', 'release-stream');
    const executable = this.fixture.install('stream');
    const source = readFileSync(executable, 'utf8');
    assert.ok(source.includes('const consumption = await this.consume();'));
    const controlled = holdProvider(source, this.release);
    const withToolResult = controlled.replace(
      'const consumption = await this.consume();',
      "const consumption = await this.consume();\n    const toolResult = await this.call('read-file', { path: 'baseline' });\n    this.emit({ type: 'item.completed', item: { type: 'mcp_tool_call', id: 'read-tool', result: toolResult } });",
    );
    assert.notEqual(withToolResult, source);
    const successfulReply = withToolResult.replace(
      'if (!this.task.assignment.clarifications?.length) {',
      'if (false) {',
    );
    assert.notEqual(successfulReply, withToolResult);
    writeFileSync(executable, successfulReply);
  }

  /** Start one built CLI invocation with the fixture's isolated project state. */
  start(json: boolean): ChildProcessWithoutNullStreams {
    return spawn(process.execPath, [cli, 'refine', '--rounds', '2', ...(json ? ['--json'] : [])], {
      cwd: this.fixture.root,
      env: { ...process.env, XDG_STATE_HOME: this.fixture.storage },
    });
  }

  /** Await the child after attaching the production output observer. */
  async run(json: boolean): Promise<StreamResult> {
    const child = this.start(json);
    if (!json) writeFileSync(this.release, 'release');
    const capture = attachStream(child, json, this.release);
    const status = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    return { status, ...capture };
  }
}

type StreamCapture = {
  output: string;
  streamed: Array<Record<string, any>>;
  liveProvider: boolean;
  liveToolResult: boolean;
};

/** Hold the first controlled phase until stdout exposes both complete observations. */
function holdProvider(source: string, release: string): string {
  const setup = [
    "const { watch, existsSync } = await import('node:fs');",
    'const release = ' + JSON.stringify(release) + ';',
    'const held = existsSync(release) ? Promise.resolve() : new Promise((resolve) => {',
    "  const watcher = watch(new URL('.', 'file://' + release), () => {",
    '    if (existsSync(release)) { watcher.close(); resolve(); }',
    '  });',
    '  if (existsSync(release)) { watcher.close(); resolve(); }',
    '});',
    'const consumption = await this.consume();',
  ].join('\n');
  return source
    .replace('const consumption = await this.consume();', setup)
    .replace('this.respond(consumption);', 'await held;\n    this.respond(consumption);');
}

/** Release only after the unfinished provider's observations reached the actual pipe. */
function releaseObservedPhase(capture: StreamCapture, release: string): void {
  if (!capture.liveProvider || !capture.liveToolResult) return;
  if (capture.streamed.some((record) => record.detail?.event?.type === 'turn.completed')) return;
  assert.ok(!capture.streamed.some((record) => record.type === 'result'));
  assert.ok(!capture.streamed.some(
    (record) => record.detail?.event?.item?.type === 'agent_message',
  ));
  writeFileSync(release, 'release');
}

/** Parse complete arriving JSONL lines and retain live observations before exit. */
function attachStream(
  child: ChildProcessWithoutNullStreams,
  json: boolean,
  release: string,
): StreamCapture {
  const capture: StreamCapture = {
    output: '',
    streamed: [],
    liveProvider: false,
    liveToolResult: false,
  };
  let partial = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    capture.output += chunk;
    if (!json) {
      if (child.exitCode === null && capture.output.includes('Run measurements'))
        capture.liveProvider = true;
      return;
    }
    partial += chunk;
    const lines = partial.split('\n');
    partial = lines.pop() ?? '';
    for (const line of lines) collectRecord(line, child, capture);
    releaseObservedPhase(capture, release);
  });
  return capture;
}

/** Retain each complete JSONL record and recognize provider and tool results. */
function collectRecord(
  line: string,
  child: ChildProcessWithoutNullStreams,
  capture: StreamCapture,
): void {
  const record = JSON.parse(line) as Record<string, any>;
  capture.streamed.push(record);
  if (record.type !== 'event') return;
  const event = record.detail?.event;
  if (event?.type === 'fixture.consumption') capture.liveProvider = child.exitCode === null;
  if (
    child.exitCode === null &&
    event?.type === 'item.completed' &&
    event.item?.type === 'mcp_tool_call' &&
    event.item.result !== undefined
  ) {
    capture.liveToolResult = true;
  }
}

/** Require each phase to be named in the public progress stream. */
function assertPhases(records: Array<Record<string, any>>): void {
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
  ]) {
    assert.ok(
      progress.some((message) => message?.includes('Refinement round ' + phase)),
      phase,
    );
  }
}

/** Check the controlled provider's complete events and execution order. */
function assertProviderRecords(records: Array<Record<string, any>>): void {
  const provider = records.filter((record) => record.detail?.event?.type === 'fixture.consumption');
  assert.deepEqual(
    provider.map((record) => record.detail.event.component),
    ['planner', 'architecture', 'direction', 'planner', 'architecture', 'direction'],
  );
  for (const record of provider) {
    const event = record.detail.event;
    assert.deepEqual(Object.keys(event).sort(), [
      'component',
      'consumption',
      'executable',
      'input',
      'reads',
      'type',
    ]);
    assert.ok(event.input.startsWith('## Actor and project\n'));
    assertRoundHistory(event, provider.indexOf(record));
    assert.match(event.executable, /stream-provider/);
  }
}

/** Distinguish untouched first-round inputs from consumed second-round findings. */
function assertRoundHistory(event: Record<string, any>, index: number): void {
  if (index < 3) {
    assert.deepEqual(event.consumption, []);
    assert.deepEqual(event.reads, []);
    return;
  }
  assert.ok(event.consumption.length > 0);
  assert.equal(event.consumption[0].round, '1');
  assert.ok(event.consumption[0].findings.length > 0);
  assert.ok(event.consumption[0].measurements.length > 0);
  assert.ok(event.reads.some((path: string) => path.includes('refinement-round-1.md')));
  assert.ok(event.reads.some((path: string) => path.endsWith('codex.jsonl')));
}

/** Check complete tool results and their mapped read metadata. */
function assertToolResults(records: Array<Record<string, any>>): void {
  const toolResults = records
    .map((record) => record.detail?.event)
    .filter((event) => event?.type === 'item.completed' && event.item?.type === 'mcp_tool_call');
  assert.ok(toolResults.length > 0);
  assert.deepEqual(
    toolResults.map((event) => event.item),
    Array.from({ length: 6 }, () => ({
      type: 'mcp_tool_call',
      id: 'read-tool',
      result: {
        content: [
          {
            type: 'text',
            text:
              'Path: baseline\n' +
              'SHA-256: 382edde31df119f6a9b8298cecd1d0d3a482ca4becd35b5a80827af11d2b92ac\n' +
              '\n' +
              'durable evidence\n',
          },
        ],
        structuredContent: {
          path: 'baseline',
          sha256: '382edde31df119f6a9b8298cecd1d0d3a482ca4becd35b5a80827af11d2b92ac',
          text: 'durable evidence\n',
        },
      },
    })),
  );
}

/** Require measurements and one terminal result after every observation. */
function assertTerminalOutcome(records: Array<Record<string, any>>): void {
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
  const terminal = records.at(-1);
  assert.ok(terminal);
  assert.equal(terminal.outcome.kind, 'planned');
}

/** Check full tool results, measured usage and one terminal outcome. */
function assertTerminalRecords(records: Array<Record<string, any>>): void {
  assertToolResults(records);
  assertTerminalOutcome(records);
}

/** Validate streamed output from a complete production CLI invocation. */
function assertJsonResult(result: StreamResult): void {
  assert.equal(result.status, 0, result.output);
  assert.ok(result.liveProvider, 'complete provider observation arrives before process completion');
  assert.ok(result.liveToolResult, 'complete tool result arrives before process completion');
  const records = result.output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, any>);
  assertPhases(records);
  assertProviderRecords(records);
  assertTerminalRecords(records);
}

test('built refinement streams complete ordered JSONL through the production composition', async (t) => {
  const result = await new StreamScenario(t).run(true);
  assertJsonResult(result);
});

test('built refinement identifies round and phase in live human output', async (t) => {
  const result = await new StreamScenario(t).run(false);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Refinement round 1\/2 · Plan/);
  assert.match(result.output, /Refinement round 2\/2 · Architect/);
  assert.match(result.output, /Refinement round 2\/2 · Run/);
});
