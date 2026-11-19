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
  criteria: [{ id: 'quality', description: 'Owner checks are satisfied' }],
  steps: [{ activity: 'implementation', checklist: [{ id: 'quality', criteria: ['quality'], expected: 'Checks pass' }] }],
};

test('an empty completed reply cannot bypass a captured owner check', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-required-check-'));
  const task = new StewardFixture(t, root).task;
  t.after(() => task.close());
  Object.assign(task.capture, {
    operations: {
      'owner-tests': {
        id: 'owner-tests', kind: 'command', tool: 'check', category: 'build',
        command: '/usr/bin/false', args: [], cwd: '.', network: false,
      },
    },
  });
  t.mock.method(task, 'activate', async () => ({ kind: 'completed', edits: [], checks: [] }));
  const result = await steward(
    new Agent(new Architecture()),
    task,
    milestone,
    'implementation',
    AbortSignal.timeout(5000),
  );
  assert.notEqual(result.kind, 'completed');
});
