import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CodexEvents,
  InvalidCodexResponse,
  type CodexObservation,
} from '../../src/codex-events.js';

export const suite = { owner: 'execution', level: 'unit', tags: ['regression'] } as const;

/** Verify stream framing independently from provider availability and preserve complete diagnostics. */
class EventScenario {
  readonly observed: CodexObservation[] = [];
  readonly decoder = new CodexEvents('retained-provider.jsonl', (event) =>
    this.observed.push(event),
  );

  /** Feed arbitrary transport boundaries without turning them into a file-read protocol. */
  feed(text: string) {
    for (const character of text) this.decoder.accept({ channel: 'stdout', text: character });
  }
}

test('provider framing preserves complete unknown events, Unicode and a final record without newline', () => {
  const scenario = new EventScenario();
  const unknown = { type: 'future.event', text: 'café 🛠\ncomplete content' };
  scenario.feed(JSON.stringify(unknown) + '\n');
  scenario.feed(
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: '{"answer":"whole 🛠"}' },
    }),
  );
  assert.deepEqual(scenario.decoder.answer(), { answer: 'whole 🛠' });
  assert.deepEqual(scenario.observed[0], { kind: 'event', event: unknown });
});

test('malformed provider records retain their complete text and fail with a response-repair diagnostic', () => {
  const scenario = new EventScenario();
  const malformed = '{ malformed café 🛠';
  scenario.feed(malformed + '\n');
  assert.throws(() => scenario.decoder.answer(), InvalidCodexResponse);
  assert.deepEqual(
    (scenario.observed[0] as Extract<CodexObservation, { kind: 'invalid-output' }>).text,
    malformed,
  );
});
