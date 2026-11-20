import assert from 'node:assert/strict';
import test from 'node:test';
import type { HostTask } from '../../src/index.js';
import { Clarifications } from '../../src/index.js';
import { ClarificationRequired } from '../../../workflow/src/index.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['clarification'] } as const;
const selection = { component: 'planner', activity: 'planning' };
const data = { assignment: {}, milestone: 'objective', acceptance: [] };
const question = 'Which boundary should the objective prioritize?';
const verbatim = '  Keep observed checks distinct from the reviewer verdict.';

/** Keep the same protected artifacts and observations across simulated admissions. */
class ClarificationScenario {
  readonly events: unknown[] = [];
  readonly stored = new Map<string, string>();
  readonly task = {
    capture: { project: {}, source: { revision: 'captured-staging' } },
    taskID: 'objective-task',
    observations: () => this.events,
    note: (event: unknown) => this.events.push(event),
    store: (name: string, contents: string) => {
      const path = `/fixture-evidence/${name}`;
      this.stored.set(path, contents);
      return path;
    },
    ask: async () => this.answer,
  } as unknown as HostTask;
  answer: string | undefined;

  /** Start a new requesting activation while preserving the original gate. */
  run(invoke: Parameters<Clarifications['run']>[1]) {
    const gate = new Clarifications(this.task, selection, new AbortController().signal);
    return gate.run(data, invoke);
  }
}

test('an unanswered clarification cites the retained question and resumes with the exact answer', async () => {
  const scenario = new ClarificationScenario();
  await assert.rejects(
    scenario.run(async () => ({ kind: 'question', question })),
    (error) => {
      assert(error instanceof ClarificationRequired);
      assert.equal(error.message, question);
      const [evidence] = error.evidence;
      assert(evidence);
      assert.match(scenario.stored.get(evidence) ?? '', /Which boundary/);
      return true;
    },
  );
  scenario.answer = verbatim;
  await scenario.run(async (input) => {
    assert.deepEqual(input.assignment, { clarifications: [{ question, answer: verbatim }] });
    return { summary: 'fixture' };
  });
});
