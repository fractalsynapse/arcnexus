import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import type { Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const milestone: Milestone = {
  id: 'requester',
  owner: 'owner',
  criteria: [{ id: 'work', description: 'Compile and satisfy the original assertion' }],
  steps: [],
};

/** Exercise a caller's pending check across a checked supplier contribution. */
class SupplierProgressScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-supplier-progress-'));
  readonly fixture: StewardFixture;
  private checks = 0;
  private repairing = false;

  /** Mock only provider and process results while retaining real checked edits and journal. */
  constructor(t: TestContext) {
    this.fixture = new StewardFixture(t, this.root);
    t.after(() => this.fixture.task.close());
    t.mock.method(
      this.fixture.task,
      'check',
      async (id: string, _signal: AbortSignal, scope: unknown) => this.check(id, scope),
    );
    t.mock.method(
      this.fixture.task,
      'activate',
      async (_agent: Agent, _selection: unknown, context: TaskContext) => this.reply(context),
    );
  }

  /** Record the dependency compiler failure, then the caller assertion, through normal observations. */
  private check(id: string, scope: unknown) {
    const status = this.repairing ? 0 : 1;
    const diagnostic = this.checks++ ? 'not ok 1 - caller assertion' : 'error TS2353: supplier API';
    const log = this.fixture.task.store('check.log', status ? diagnostic : 'passed');
    const check = { id, status, log, command: 'fixture', args: [], cwd: this.root, durationMs: 0 };
    this.fixture.task.note({ check, scope });
    return check;
  }

  /** Expose the original failure, then correct only the caller-owned file on request. */
  private reply(context: TaskContext) {
    if (this.repairing) {
      assert.match(JSON.stringify(context.assignment), /"status":1/);
      this.fixture.task.edits('owner', 'implementation', [
        { path: 'fixture.txt', expected: null, content: 'corrected' },
      ]);
    }
    return { kind: 'completed', edits: [], checks: [{ id: 'owner-tests', expected: 'pass' }] };
  }

  /** Resume the same accepted milestone through the production steward boundary. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.fixture.task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
  }

  /** Record a supplier-owned dependency edit without granting the caller its scope. */
  supply() {
    this.fixture.task.edits('other', 'implementation', [
      { path: 'other.txt', expected: null, content: 'supplier interface corrected' },
    ]);
  }

  /** Enable a local caller correction after observing the new remaining diagnostic. */
  repair() {
    this.repairing = true;
    return this.run();
  }
}

test('checked supplier progress returns a remaining check failure to the original caller', async (t) => {
  const scenario = new SupplierProgressScenario(t);
  assert.equal((await scenario.run()).kind, 'repair');
  scenario.supply();
  const remaining = await scenario.run();
  assert.equal(remaining.kind, 'repair', JSON.stringify(remaining));
  assert.equal((await scenario.repair()).kind, 'completed');
  assert.equal(readFileSync(join(scenario.root, 'fixture.txt'), 'utf8'), 'corrected');
  assert.equal(
    readFileSync(join(scenario.root, 'other.txt'), 'utf8'),
    'supplier interface corrected',
  );
});

test('a supplier contribution does not permit repeated retries without subsequent progress', async (t) => {
  const scenario = new SupplierProgressScenario(t);
  assert.equal((await scenario.run()).kind, 'repair');
  scenario.supply();
  assert.equal((await scenario.run()).kind, 'repair');
  assert.equal((await scenario.run()).kind, 'blocked');
});
