import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { Context } from 'cordis';
import { runTask } from '../../src/task.js';
import type { TaskObserver } from '../../../../packages/workflow/src/index.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

/** Exercise the actual terminal adapter with structured SDK observations and isolated terminal streams. */
class TerminalScenario {
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];
  completed = false;

  /** Capture application output without invoking an external provider or hosted delivery. */
  constructor(t: TestContext) {
    const previous = process.exitCode;
    t.after(() => {
      process.exitCode = previous;
    });
    t.mock.method(process.stdout, 'write', (value: string | Uint8Array) => {
      this.stdout.push(Buffer.isBuffer(value) ? value.toString() : String(value));
      return true;
    });
    t.mock.method(process.stderr, 'write', (value: string | Uint8Array) => {
      this.stderr.push(Buffer.isBuffer(value) ? value.toString() : String(value));
      return true;
    });
  }

  /** Emit observations while the SDK call is still active, followed by its terminal result. */
  async run(json: boolean) {
    const commands = {
      runTask: async (_input: unknown, observer: TaskObserver) => {
        observer.progress({ phase: 'activity', message: 'Execution is testing' });
        observer.event?.({
          sequence: '1',
          run: 1,
          taskID: 'task',
          goalID: 'goal',
          timestamp: '2026-11-19T00:00:00.000Z',
          observation: { operation: { name: 'test', result: 'complete café 🛠' } },
        });
        assert(this.stdout.length, 'observations must be visible before the SDK call completes');
        this.completed = true;
        return { kind: 'blocked', reason: 'Pending exact approval', evidence: [] };
      },
    } as unknown as Context['commands'];
    await runTask(commands, { command: 'task_run', goal: 'Exercise live terminal output' }, json);
  }
}

test('GW-31: JSON task mode streams typed JSONL observations and a terminal result', async (t) => {
  const scenario = new TerminalScenario(t);
  await scenario.run(true);
  const records = scenario.stdout
    .join('')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    records.map(({ type }) => type),
    ['progress', 'event', 'result'],
  );
  assert.equal(records[1].observation.operation.result, 'complete café 🛠');
  assert.equal(records[2].outcome.kind, 'blocked');
  assert.equal(process.exitCode, 1);
});

test('GW-31: human task mode shows complete live operation observations', async (t) => {
  const scenario = new TerminalScenario(t);
  await scenario.run(false);
  assert.match(scenario.stdout.join(''), /complete café 🛠/);
  assert.match(scenario.stdout.join(''), /Execution is testing/);
});
