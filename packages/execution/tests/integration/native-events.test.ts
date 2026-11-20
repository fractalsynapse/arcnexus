import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Agent } from '../../../agent/src/index.js';
import type { AgentInspection } from '../../../architecture/src/index.js';
import type { JournalEvent } from '../../../coordination/src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Exercise production activation and persistence with a controlled executable provider. */
class NativeScenario {
  readonly task: StewardFixture['task'];
  readonly events: JournalEvent[] = [];
  readonly input = 'Complete selected activity context café 🛠';
  finished = false;

  /** Own an isolated task and a generated provider executable, never a live model substitution. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-native-events-'));
    execFileSync('git', ['init', '-q', root]);
    this.task = new StewardFixture(t, root).task;
    t.after(() => this.task.close());
    const executable = join(root, 'provider.mjs');
    const fixture = readFileSync(
      fileURLToPath(new URL('../fixtures/provider-events.js', import.meta.url)),
      'utf8',
    );
    writeFileSync(executable, fixture.replace(/^#![^\n]*/, `#!${process.execPath}`), {
      mode: 0o700,
    });
    Object.assign(this.task.capture.source, { paths: [] });
    Object.assign(this.task.config, { executable });
    this.task.listen((event) => {
      assert.equal(this.finished, false);
      this.events.push(event);
    });
  }

  /** Run the exact native Codex/MCP boundary and capture its actual controlled events. */
  async run() {
    const view = this.view();
    const agent = {
      activate: (
        _input: unknown,
        invoke: (view: AgentInspection, signal: AbortSignal) => unknown,
      ) => invoke(view, new AbortController().signal),
    } as unknown as Agent;
    const result = await this.task.activate(
      agent,
      { component: 'owner', activity: 'implementation' },
      {},
      new AbortController().signal,
    );
    this.finished = true;
    return result;
  }

  /** Provide an explicit generic resolved view rather than relying on repository policy fixtures. */
  private view() {
    return {
      component: 'owner',
      activity: 'implementation',
      request: {
        input: this.input,
        options: {
          workingDirectory: this.task.worktree!,
          model: 'fixture-model',
          modelReasoningEffort: 'high',
          webSearchMode: 'disabled',
          tools: [],
        },
      },
    } as unknown as AgentInspection;
  }

  /** Check complete durable payloads, profile attribution and separate provider streams. */
  assertObservations() {
    const records = this.events.map(({ observation }) => observation) as Record<string, any>[];
    const start = records.find(({ nativeStarted }) => nativeStarted)?.nativeStarted;
    assert(start, 'activation must record its exact request before invoking the provider');
    assert.equal(start.profile, 'profile');
    assert.equal(JSON.parse(readFileSync(start.request, 'utf8')).input, this.input);
    const events = records.flatMap(({ nativeEvent }) => (nativeEvent ? [nativeEvent] : []));
    const details = this.events.flatMap(({ detail }) => (detail ? [detail as any] : []));
    assert(
      details.some(({ event }) => event?.type === 'vendor.future' && event.request === this.input),
    );
    assert(
      events.some(
        ({ event }) => event?.type === 'item.completed' && event.item.type === 'mcp_tool_call',
      ),
    );
    assert(events.some(({ event }) => event?.usage?.cached_input_tokens === 80));
    const end = records.find(({ nativeFinished }) => nativeFinished)?.nativeFinished;
    assert(end && end.durationMs >= 0);
    assert.match(readFileSync(end.stderr, 'utf8'), /provider diagnostic café 🛠/);
    const timeline = this.task.readFile(this.task.timeline!).text;
    assert.match(timeline, /nativeStarted/);
    assert.match(timeline, /nativeFinished/);
    assert(
      !JSON.stringify(this.task.observations()).includes(this.input),
      'bulk provider content stays in complete files rather than being reloaded with task state',
    );
    for (const line of readFileSync(start.activation, 'utf8').trim().split('\n')) JSON.parse(line);
  }
}

test('EX-26: production activation streams and retains requests, unknown events, tools and usage', async (t) => {
  const scenario = new NativeScenario(t);
  await scenario.run();
  scenario.assertObservations();
});
