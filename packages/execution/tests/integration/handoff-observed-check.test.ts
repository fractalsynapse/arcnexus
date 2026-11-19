import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

test('a supplier handoff preserves an observed failure when the steward resumes', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-handoff-check-'));
  const task = new StewardFixture(t, root).task;
  t.after(() => task.close());
  const milestone: Milestone = {
    id: 'requester',
    owner: 'owner',
    criteria: [{ id: 'fixture', description: 'Fixture passes' }],
    steps: activities.map((activity) => ({
      activity,
      checklist: [],
      inapplicable: 'Fixture',
    })),
  };
  const signal = new AbortController().signal;
  const log = task.store('failed.log', 'fixture diagnostic');
  t.mock.method(task, 'check', async (id, _signal, scope) => {
    const check = { id, status: 7, log, command: 'fixture', args: [], cwd: root, durationMs: 1 };
    task.note({ check, scope });
    return check;
  });
  let calls = 0;
  t.mock.method(task, 'activate', async (_agent, selection, input: TaskContext) => {
    if (calls++ > 0) return { kind: 'completed', edits: [], checks: [] };
    const tools = new ActivationTools(task, selection, input, signal);
    await tools.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'pass' });
    await tools.invoke(
      { name: 'request-supplier', handler: 'supplier' },
      { owner: 'other', milestone: 'supplier', reason: 'Distinct work' },
    );
    return tools.finish({ kind: 'completed' });
  });
  const agent = new Agent(new Architecture());
  const handoff = await steward(agent, task, milestone, 'implementation', signal);
  assert.equal(handoff.kind, 'supplier');
  const resumed = await steward(agent, task, milestone, 'implementation', signal);
  assert.equal(resumed.kind, 'repair');
  if (resumed.kind === 'repair') {
    assert.equal(resumed.failedCheck?.expected, 'pass');
    assert.equal(resumed.failedCheck?.status, 7);
    assert.equal(resumed.failedCheck?.log, log);
  }
});
