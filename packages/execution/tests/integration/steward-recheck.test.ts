import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
const milestone: Milestone = {
  id: 'original',
  owner: 'owner',
  criteria: [],
  steps: activities.map((activity) => ({ activity, checklist: [] })),
};

/** Count real steward-boundary requests while controlling native result observations. */
class RecheckScenario {
  readonly task;
  calls = 0;

  /** Seed the prior obligation and optionally observe another check during the caller activation. */
  constructor(t: TestContext, nativeStatus: number | undefined) {
    this.task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-recheck-'))).task;
    t.after(() => this.task.close());
    this.observe(1);
    t.mock.method(this.task, 'check', async () => {
      this.calls++;
      return this.observe(nativeStatus ?? 0);
    });
    t.mock.method(this.task, 'activate', async () => {
      if (nativeStatus !== undefined)
        await this.task.check('owner-tests', new AbortController().signal, scope);
      return { kind: 'completed', edits: [], checks: [] };
    });
  }

  /** Journal exact controlled results so the production pending-check reducer remains under test. */
  private observe(status: number) {
    const check = {
      id: 'owner-tests',
      status,
      log: this.task.store('controlled.log', status ? 'error TS1005: Exact finding' : 'passed'),
      command: 'fixture',
      args: [],
      cwd: '.',
      durationMs: 0,
    };
    this.task.note({ check, scope });
    return check;
  }

  /** Run the production steward boundary against its existing pending obligation. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
  }
}

for (const status of [0, 1, undefined]) {
  test(`reconcile the caller result once without replaying an unchanged new observation: ${status}`, async (t) => {
    const scenario = new RecheckScenario(t, status);
    const outcome = await scenario.run();
    assert.equal(outcome.kind, status === 1 ? 'blocked' : 'completed');
    assert.equal(scenario.calls, 1);
  });
}
