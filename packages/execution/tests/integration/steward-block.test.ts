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
  id: 'original',
  owner: 'owner',
  criteria: [{ id: 'work', description: 'Use the available public API' }],
  steps: [],
};

/** Reproduce a model asserting a missing public capability while retaining prior checked work. */
class ReportedBlockScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-reported-block-'));
  readonly fixture: StewardFixture;
  calls = 0;

  /** Control only the model boundary; use real checked edits and the existing journal. */
  constructor(
    t: TestContext,
    private readonly repeated: boolean,
  ) {
    this.fixture = new StewardFixture(t, this.root);
    t.mock.method(
      this.fixture.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.reply(data),
    );
  }

  /** Preserve an acknowledged file before reporting the unsupported block. */
  private reply(data: TaskContext) {
    this.calls++;
    if (this.calls === 1) {
      this.fixture.task.edits('owner', 'implementation', [
        { path: 'earlier.txt', expected: null, content: 'retained' },
      ]);
      return { kind: 'blocked', reason: 'No host artifact API is available' };
    }
    assert.match(JSON.stringify(data.assignment), /No host artifact API is available/);
    assert.equal(typeof this.fixture.task.store, 'function');
    assert.equal(readFileSync(join(this.root, 'earlier.txt'), 'utf8'), 'retained');
    return this.repeated
      ? { kind: 'blocked', reason: 'The artifact interface is still absent' }
      : { kind: 'completed', edits: [], checks: [] };
  }

  /** Activate the same steward once and always release the real fixture journal. */
  async run() {
    try {
      return await steward(
        new Agent(new Architecture()),
        this.fixture.task,
        milestone,
        'implementation',
        new AbortController().signal,
      );
    } finally {
      this.fixture.task.close();
    }
  }
}

test('an unverified capability block returns to its caller and preserves prior checked work', async (t) => {
  const scenario = new ReportedBlockScenario(t, false);
  assert.equal((await scenario.run()).kind, 'completed');
  assert.equal(scenario.calls, 2);
});

test('rephrased unverified blocks hold after unchanged investigation instead of looping', async (t) => {
  const scenario = new ReportedBlockScenario(t, true);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'blocked');
  assert.match(outcome.reason, /artifact interface is still absent/);
  assert.equal(scenario.calls, 2);
});
