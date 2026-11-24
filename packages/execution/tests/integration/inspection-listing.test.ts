import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import type { HostTask } from '../../src/index.js';
import { InspectionFixture } from '../fixtures/inspection.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Read durable journal metadata, never substituting transient observer details for retention. */
function timeline(task: HostTask): Array<any> {
  return task.readFile(task.timeline!).text.trim().split('\n').map((line) => JSON.parse(line));
}

/** Read the actual provider receipt from its complete registered transcript. */
function receipt(task: HostTask) {
  const path = task.evidence.find((path) => path.endsWith('codex.jsonl'));
  assert.ok(path);
  const frames = readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const probe = frames.find((frame) => frame.type === 'fixture.inspection');
  assert.ok(probe, 'the controlled executable must complete its actual MCP exchange');
  return probe;
}

/** Require complete response bytes, attribution and call identity inside the native journal span. */
function assertRetained(task: HostTask, view: AgentInspection, tools: unknown) {
  const events = timeline(task);
  const listings = events.filter((event) =>
    event.observation.operation?.name === 'tools/list' &&
    event.observation.operation.phase === 'completed',
  );
  assert.equal(listings.length, 1, 'retain the single requested tools/list response');
  const event = listings[0]!;
  const operation = event.observation.operation;
  assert.equal(operation.component, view.component);
  assert.equal(operation.activity, view.activity);
  assert.equal(typeof operation.call, 'string');
  assert.ok(operation.call.length > 0);
  assert.ok(task.journal.artifactRecorded(operation.source));
  const stored = JSON.parse(task.readFile(operation.source).text);
  assert.equal(stored.call, operation.call);
  assert.equal(stored.phase, operation.phase);
  assert.deepEqual(stored.result, { tools });
  const position = events.indexOf(event);
  assert.ok(position > events.findIndex((event) => event.observation.nativeStarted));
  assert.ok(position < events.findIndex((event) => event.observation.nativeFinished));
}

for (const activity of ['testing', 'documentation', 'empty'] as const) {
  test('EX-26: retain requested activity tool listing for work/' + activity, async (t) => {
    const fixture = new InspectionFixture(t);
    const task = await fixture.open(t);
    const handler = t.mock.method(ActivationTools.prototype, 'invoke', async () =>
      assert.fail('tools/list dispatched a project handler'),
    );
    const selection = { component: 'work', activity };
    const data = { assignment: { instructions: 'Fixture mode: listing only' } };
    const view = fixture.agent.prepareRequest(task.capture, selection, data);
    await task.activate(fixture.agent, selection, data, new AbortController().signal);
    const probe = receipt(task);
    const expected = view.request.options.tools.map(({ handler: _handler, ...tool }) => tool);
    assert.deepEqual(probe.tools, expected);
    assert.deepEqual(probe.refusals, []);
    assert.equal(handler.mock.callCount(), 0);
    assertRetained(task, view, probe.tools);
  });
}

for (const activity of ['testing', 'empty'] as const) {
  test('EX-26: do not fabricate an unrequested listing for work/' + activity, async (t) => {
    const fixture = new InspectionFixture(t);
    const task = await fixture.open(t);
    const handler = t.mock.method(ActivationTools.prototype, 'invoke', async () =>
      assert.fail('a provider with no MCP requests dispatched a project handler'),
    );
    await task.activate(
      fixture.agent,
      { component: 'work', activity },
      { assignment: { instructions: 'Fixture mode: no MCP requests' } },
      new AbortController().signal,
    );
    assert.equal(Object.hasOwn(receipt(task), 'tools'), false);
    assert.equal(handler.mock.callCount(), 0);
    assert.deepEqual(
      timeline(task).filter((event) => event.observation.operation),
      [],
      'an unused MCP boundary must retain no fabricated operation observations',
    );
  });
}
