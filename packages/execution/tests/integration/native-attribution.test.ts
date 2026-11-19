import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

const input = 'repair café 🛠';

/** Invoke the actual native boundary with a failing provider and retain its journal. */
async function scenario(t: TestContext, component: string, activity: string, profile: string) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-attribution-'));
  execFileSync('git', ['init', '-q', root]);
  const task = new StewardFixture(t, root).task;
  t.after(() => task.close());
  Object.assign(task.capture.source, { paths: [] });
  Object.assign(task.capture.components, {
    [component]: { id: component, activities: { [activity]: { profile } } },
  });
  Object.assign(task.config, { executable: '/usr/bin/false' });
  const view = {
    component,
    activity,
    request: {
      input,
      options: {
        workingDirectory: root,
        model: 'captured-model',
        modelReasoningEffort: 'high',
        webSearchMode: 'disabled',
        tools: [],
      },
    },
  } as unknown as AgentInspection;
  const agent = {
    activate: (_input: unknown, invoke: (view: AgentInspection, signal: AbortSignal) => unknown) =>
      invoke(view, new AbortController().signal),
  } as unknown as Agent;
  await assert.rejects(
    task.activate(agent, { component, activity }, { assignment: {} }, new AbortController().signal),
    /Codex activation failed/,
  );
  return task.observations<{ nativeInvocation?: unknown }>();
}

for (const [component, activity, profile] of [
  ['direction', 'planning', 'director-profile'],
  ['owner', 'implementation', 'repair-profile'],
] as const) {
  test(`native invocation records ${component}/${activity} bytes before provider failure`, async (t) => {
    const records = await scenario(t, component, activity, profile);
    assert.deepEqual(
      records.filter((entry) => entry.nativeInvocation).map((entry) => entry.nativeInvocation),
      [{ inputBytes: Buffer.byteLength(input, 'utf8'), component, activity, model: 'captured-model', profile }],
    );
    assert(Buffer.byteLength(input, 'utf8') > input.length);
  });
}
