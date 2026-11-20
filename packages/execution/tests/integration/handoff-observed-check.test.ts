import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const milestone: Milestone = {
  id: 'requester',
  owner: 'owner',
  criteria: [{ id: 'fixture', description: 'Fixture passes' }],
  steps: activities.map((activity) => ({ activity, checklist: [], inapplicable: 'Fixture' })),
};

/** Retain one failed native operation across a supplier handoff through real steward state. */
class HandoffScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-handoff-check-'));
  readonly task;
  readonly log: string;
  readonly signal = new AbortController().signal;
  private calls = 0;

  /** Replace external activity execution and command results while retaining the real journal. */
  constructor(t: TestContext) {
    this.task = new StewardFixture(t, this.root).task;
    this.log = this.task.store('failed.log', 'fixture diagnostic');
    t.after(() => this.task.close());
    t.mock.method(
      this.task,
      'check',
      async (id: string, _signal: AbortSignal, scope?: Parameters<typeof this.task.check>[2]) =>
        this.observe(id, scope),
    );
    t.mock.method(
      this.task,
      'activate',
      async (
        _agent: Agent,
        selection: Parameters<typeof this.task.activate>[1],
        input: TaskContext,
      ) => this.reply(selection, input),
    );
  }

  /** Retain a controlled failure using the real host observation ledger. */
  private observe(id: string, scope?: Parameters<typeof this.task.check>[2]) {
    const check = {
      id,
      status: 7,
      log: this.log,
      command: 'fixture',
      args: [],
      cwd: this.root,
      durationMs: 1,
    };
    this.task.note({ check, scope });
    return check;
  }

  /** Request a supplier after the failed check and preserve that observation on resumption. */
  private async reply(selection: Parameters<typeof this.task.activate>[1], input: TaskContext) {
    if (this.calls++ > 0) return { kind: 'completed', edits: [], checks: [] };
    const tools = new ActivationTools(this.task, selection, input, this.signal);
    await tools.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'pass' });
    await tools.invoke(
      { name: 'request-supplier', handler: 'supplier' },
      { owner: 'other', milestone: 'supplier', reason: 'Distinct work' },
    );
    return tools.finish({ kind: 'completed' });
  }

  /** Resume the same accepted caller without changing ownership or its expected pass. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.task,
      milestone,
      'implementation',
      this.signal,
    );
  }
}

test('a supplier handoff preserves an observed failure when the steward resumes', async (t) => {
  const scenario = new HandoffScenario(t);
  assert.equal((await scenario.run()).kind, 'supplier');
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'blocked');
  assert(resumed.kind === 'blocked');
  assert.equal(resumed.failedCheck?.expected, 'pass');
  assert.equal(resumed.failedCheck?.status, 7);
  assert.equal(resumed.failedCheck?.log, scenario.log);
});
