import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import type { Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import type { ResearchResult } from '../../src/research.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

const milestone: Milestone = {
  id: 'answer-repair',
  owner: 'owner',
  criteria: [{ id: 'work', description: 'Use the complete answer to finish assigned work' }],
  steps: [],
};

/** Drive reply repair with real retained answers and a controlled model boundary. */
class AnswerRepairScenario {
  readonly fixture: StewardFixture;
  calls = 0;

  /** Keep answers and diagnostics in the existing isolated SQLite journal. */
  constructor(
    t: TestContext,
    private readonly kind: 'research' | 'clarification',
    private readonly duplicate: boolean,
  ) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-answer-repair-'));
    this.fixture = new StewardFixture(t, root);
    if (duplicate) this.recordAnswer();
    t.mock.method(
      this.fixture.task,
      'activate',
      async (_agent: Agent, _selection: unknown, input: TaskContext) => this.respond(input),
    );
  }

  /** Repeat the exact invalid response after an answer arrives, then finish its repair. */
  private respond(input: TaskContext) {
    this.calls++;
    if (this.calls > 1)
      assert.match(JSON.stringify(input.assignment), /response\.reason.*nonempty string/);
    if (this.calls === 2) {
      this.recordAnswer();
      this.fixture.task.store('diagnostic.txt', 'Another artifact is not new knowledge');
    }
    if (this.calls < 3) return { kind: 'blocked' };
    return { kind: 'completed', edits: [], checks: [] };
  }

  /** Retain complete answer content through the same host records used during activation. */
  private recordAnswer() {
    const task = this.fixture.task;
    const answer = 'Use the public service and preserve every originating observation.';
    if (this.kind === 'clarification') {
      task.note({ clarification: { scope: 'owner:implementation', question: 'How?', answer } });
      return;
    }
    const evidence = task.store('research.md', answer);
    const digest = createHash('sha256').update(answer).digest('hex');
    const result: ResearchResult = {
      component: 'owner',
      evidence,
      digest,
      request: {
        id: digest,
        inbox: 'owner:implementation',
        requestedBy: { component: 'owner', activity: 'implementation' },
        question: 'How should the public integration fixture be composed?',
        decision: 'Choose the normal request path',
      },
    };
    task.note({ researchResult: result });
  }

  /** Invoke the public steward once without replacing repair, edits or journal behavior. */
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

for (const kind of ['research', 'clarification'] as const) {
  test(`a new complete ${kind} answer permits caller repair of the same diagnostic`, async (t) => {
    const scenario = new AnswerRepairScenario(t, kind, false);
    assert.equal((await scenario.run()).kind, 'completed');
    assert.equal(scenario.calls, 3);
  });

  test(`replaying a ${kind} answer and artifacts cannot manufacture caller progress`, async (t) => {
    const scenario = new AnswerRepairScenario(t, kind, true);
    const outcome = await scenario.run();
    assert.equal(outcome.kind, 'blocked');
    assert.equal(scenario.calls, 2);
    assert.match(outcome.reason, /Steward reply repair failed/);
  });
}

test('unanswered questions and new artifacts do not renew an unchanged reply', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-unanswered-repair-'));
  const { task } = new StewardFixture(t, root);
  const replies = t.mock.method(task, 'activate', async () => {
    task.note({ clarification: { scope: 'owner:implementation', question: 'Still pending?' } });
    task.store('pending.txt', 'This observation does not contain an answer');
    return { kind: 'blocked' };
  });
  try {
    const outcome = await steward(
      new Agent(new Architecture()),
      task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
    assert.equal(outcome.kind, 'blocked');
    assert.equal(replies.mock.callCount(), 2);
  } finally {
    task.close();
  }
});
