import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { execute } from '../../src/process.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

interface Output {
  channel: 'stdout' | 'stderr';
  text: string;
}

/** Exercise streamed process observations using actual pipes and controlled provider output. */
class ProcessScenario {
  readonly root: string;
  readonly outputs: Output[] = [];
  finished = false;

  /** Keep test logs outside maintained source and remove them after observation. */
  constructor(t: TestContext) {
    this.root = mkdtempSync(join(tmpdir(), 'arcnexus-process-events-'));
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
  }

  /** Record each observed output before the public execution promise completes. */
  observe(output: Output) {
    assert.equal(this.finished, false);
    this.outputs.push(output);
  }

  /** Invoke the real supervisor with separate complete stdout and stderr logs. */
  async run() {
    const fixture = fileURLToPath(new URL('../fixtures/provider-events.js', import.meta.url));
    const options = {
      cwd: this.root,
      signal: new AbortController().signal,
      log: join(this.root, 'stdout.jsonl'),
      stderrLog: join(this.root, 'stderr.log'),
      input: 'Complete task direction café 🛠',
      output: (event: Output) => this.observe(event),
    };
    const result = await execute(process.execPath, [fixture], options);
    this.finished = true;
    return result;
  }
}

test('EX-26: process output is observable before completion with separate complete streams', async (t) => {
  const scenario = new ProcessScenario(t);
  const result = await scenario.run();
  assert.equal(result.status, 0);
  assert(scenario.outputs.length, 'real output must reach the live observer');
  for (const channel of ['stdout', 'stderr'] as const) {
    const observed = scenario.outputs
      .filter((event) => event.channel === channel)
      .map(({ text }) => text)
      .join('');
    assert.equal(observed, result[channel]);
  }
  assert.equal(readFileSync(join(scenario.root, 'stdout.jsonl'), 'utf8'), result.stdout);
  assert.equal(readFileSync(join(scenario.root, 'stderr.log'), 'utf8'), result.stderr);
  for (const line of result.stdout.trim().split('\n')) assert.doesNotThrow(() => JSON.parse(line));
  assert.match(result.stderr, /café 🛠/);
});

test('an output observer failure returns through managed execution rather than an uncaught exception', async (t) => {
  const scenario = new ProcessScenario(t);
  const failure = new Error('Observer could not persist this output');
  t.mock.method(scenario, 'observe', () => {
    throw failure;
  });
  await assert.rejects(scenario.run(), (error) => error === failure);
  assert(readFileSync(join(scenario.root, 'stdout.jsonl'), 'utf8').length);
});
