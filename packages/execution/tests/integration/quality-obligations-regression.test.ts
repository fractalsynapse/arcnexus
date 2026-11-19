import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import type { Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

const milestone: Milestone = {
  id: 'quality',
  owner: 'owner',
  criteria: [{ id: 'quality', description: 'Each applicable operation is satisfied' }],
  steps: [{
    activity: 'implementation',
    checklist: [{ id: 'quality', criteria: ['quality'], expected: 'Checks pass independently' }],
  }],
};

for (const missing of ['owner-format', 'owner-lint', 'repository-types']) {
  test(`an unrelated successful observation cannot satisfy omitted ${missing}`, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-quality-obligation-'));
    const task = new StewardFixture(t, root).task;
    t.after(() => task.close());
    const ids = ['owner-format', 'owner-lint', 'repository-types'];
    const operations = Object.fromEntries(ids.map((id) => [id, {
      id, kind: 'command', tool: 'check', category: 'build',
      command: '/usr/bin/false', args: [], cwd: '.', network: false,
    }]));
    Object.assign(task.capture, { operations });
    Object.assign(task.capture.components.owner!.activities.implementation!, { operations: ids });
    const unrelated = ids.find((id) => id !== missing)!;
    t.mock.method(task, 'activate', async () => {
      const log = task.store('unrelated.log', 'controlled passing observation');
      task.note({
        check: { id: unrelated, status: 0, log, command: 'fixture', args: [], cwd: root, durationMs: 0 },
        scope: { owner: 'owner', activity: 'implementation', expected: 'pass' },
      });
      return { kind: 'completed', edits: [], checks: [] };
    });
    const result = await steward(
      new Agent(new Architecture()), task, milestone, 'implementation', AbortSignal.timeout(5000),
    );
    assert.notEqual(result.kind, 'completed', `${missing} lacks current evidence`);
  });
}
