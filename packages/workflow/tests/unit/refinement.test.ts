import assert from 'node:assert/strict';
import test from 'node:test';
import { Workflow, type TaskObserver, type TaskOutcome } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'unit', tags: ['regression'] } as const;

test('a cancelled refinement stops before admitting any phase', async () => {
  const controller = new AbortController();
  controller.abort();
  const workflow = new Workflow();
  const refine = Reflect.get(workflow, 'refine') as
    | ((
        directory: string,
        rounds: string,
        observer: TaskObserver,
        signal: AbortSignal,
      ) => Promise<TaskOutcome>)
    | undefined;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  const outcome = await refine!.call(workflow, '.', '1', { progress() {} }, controller.signal);
  assert.equal(outcome.kind, 'cancelled');
});
