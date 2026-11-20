import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { JournalEvent } from '../../../coordination/src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['regression', 'evidence'],
} as const;

/** Exercise readable timeline and complete transient streaming against one real host journal. */
class TimelineScenario {
  private readonly task;
  private readonly streamed: JournalEvent[] = [];

  /** Register one foreground observer without a provider, mock journal or second log store. */
  constructor(context: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-timeline-'));
    this.task = new StewardFixture(context, root).task;
    this.task.listen((event) => this.streamed.push(event));
    context.after(() => this.task.close());
  }

  /** Retain complete file-read results once and require the live index to match canonical journal replay. */
  verify() {
    const text = readFileSync(this.task.timeline!, 'utf8');
    const detail = { args: { path: this.task.timeline }, result: { text } };
    const source = this.task.store('mcp-observation.json', JSON.stringify(detail));
    this.task.note({ operation: { name: 'read-file', phase: 'completed', source } }, detail);
    const timeline = readFileSync(this.task.timeline!, 'utf8')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(timeline, JSON.parse(JSON.stringify(this.task.journal.timeline())));
    assert(timeline.every((event) => !Object.hasOwn(event, 'detail')));
    assert.deepEqual(JSON.parse(readFileSync(source, 'utf8')), detail);
    assert.deepEqual(this.streamed.at(-1)!.detail, detail);
    assert.equal(timeline.at(-1)!.observation.operation.source, source);
  }
}

test('CO-24: reading the timeline retains full source evidence without embedding payloads into its own index', (context) => {
  new TimelineScenario(context).verify();
});
