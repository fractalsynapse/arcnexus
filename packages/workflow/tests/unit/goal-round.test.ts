import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import {
  Workflow,
  type StandingGoal,
  type TaskInput,
  type WorkflowServices,
} from '../../src/index.js';

const ids = ['checkpoint', 'ownership', 'inspect', 'tests', 'delivery'];
const goals: StandingGoal[] = ids.map((id, index) => ({
  id,
  priority: index + 1,
  owner: id,
  body: `# ${id}\nMeasure the current staging revision.\n`,
}));
const signal = new AbortController().signal;

/** Track staging evaluations and guard against entering the engineering loop when measures pass. */
class RoundScenario {
  readonly admissions: TaskInput[] = [];
  readonly completed: number[] = [];
  private round = 1;

  private readonly services: WorkflowServices = {
    execution: {
      round: () => ({ id: this.round, goals, finish: () => this.complete() }),
      admit: async (input) => this.admit(input),
      evaluate: async (_session, owner) => ({
        kind: 'satisfied',
        commit: 'current-staging',
        evidence: [owner],
      }),
      assemble: async () => assert.fail('A passing observation has no assembled candidate'),
    },
    direction: {
      plan: async () => assert.fail('Passing goals do not require a plan'),
      revise: async () => assert.fail('Passing goals do not require a revision'),
    },
    agent: { execute: async () => assert.fail('Passing goals do not require an activation') },
    verification: { assess: async () => assert.fail('Passing goals do not require acceptance') },
    delivery: { integrate: async () => assert.fail('A passing observation has no publication') },
  };

  /** Evaluate one complete goal round through the public Workflow entry point. */
  run() {
    return new Workflow(this.services).round('.', { progress() {} }, signal);
  }

  /** Finish the observed round before allocating the next identity. */
  private complete() {
    this.completed.push(this.round++);
  }

  /** Record each admission and return a bounded fixture session. */
  private admit(input: TaskInput) {
    this.admissions.push(input);
    return {
      capture: {} as Capture,
      goal: input.goal,
      record() {},
      finish() {},
      close() {},
    };
  }
}

test('three goal rounds evaluate the same five goals in priority order with distinct task identities', async () => {
  const fixture = new RoundScenario();
  for (const round of [1, 2, 3]) {
    const outcome = await fixture.run();
    assert(outcome.completed);
    assert.equal(outcome.round, round);
    assert.deepEqual(
      outcome.goals.map(({ id }) => id),
      ids,
    );
    assert(
      outcome.goals.every(
        ({ outcome: result }) => result.kind === 'satisfied' && result.evidence.length,
      ),
    );
  }
  assert.deepEqual(fixture.completed, [1, 2, 3]);
  assert.equal(new Set(fixture.admissions.map(({ scope }) => scope)).size, 15);
});
