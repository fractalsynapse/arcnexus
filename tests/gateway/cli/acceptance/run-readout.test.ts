import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunReadout } from '../../../../dist/gateway/cli/run-readout.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Streams one run's events through the single readout, including work created after it starts. */
class ReadoutScenarios {
  /**
   * An in-place run admits its assignments only after direction completes.
   *
   * The identifier set gathered on the first poll knows nothing about them, so every later
   * assignment event - including the verification failure that ends such a run - would be filtered
   * out of the stream that is supposed to be the only place an operator reads what happened.
   */
  async lateAssignment(): Promise<void> {
    const runId = 'run-one';
    const assignmentId = 'assignment-one';
    const lines = await this.capture(async () => {
      const readout = new RunReadout(this.host(runId, assignmentId), runId);
      await readout.poll();
      await readout.poll();
    });
    const streamed = lines.map((line) => JSON.parse(line) as { sequence?: number; id?: string });
    assert.deepEqual(
      streamed.map((line) => line.sequence),
      [1, 2, 3],
      'the stream must include the assignment failure created after the run began',
    );
    assert.equal(streamed.at(-1)?.id, assignmentId);
  }

  /**
   * A host that has no assignments until the admission event has been delivered.
   *
   * The stage advance and the late assignment list mirror the order a real run produces, so the
   * readout cannot pass by knowing the identifier up front.
   */
  private host(runId: string, assignmentId: string) {
    const batches = this.stages(runId, assignmentId);
    let assignments: Array<{ id?: string }> = [];
    let stage = 0;
    return async (action: string, extra?: Record<string, unknown>) => {
      if (action === 'task-status') return { assignments };
      if (action !== 'events') return {};
      const after = Number(extra?.after ?? 0);
      const batch = (batches[stage] ?? []).filter((event) => event.sequence > after);
      stage += 1;
      // The assignment exists in the store only once direction has admitted it.
      if (batch.some((event) => event.type === 'direction.admitted'))
        assignments = [{ id: assignmentId }];
      return batch;
    };
  }

  /** The stored events a host delivers, one batch per poll. */
  private stages(runId: string, assignmentId: string) {
    return [
      [
        {
          sequence: 1,
          type: 'run.created',
          data: JSON.stringify({ id: runId, status: 'running' }),
        },
        { sequence: 2, type: 'direction.admitted', data: JSON.stringify({ id: runId }) },
      ],
      [
        {
          sequence: 3,
          type: 'assignment.failed',
          data: JSON.stringify({
            id: assignmentId,
            status: 'failed',
            reason: 'Command failed (1)',
          }),
        },
      ],
    ];
  }

  /** Collects what the readout wrote instead of letting it reach the terminal. */
  private async capture(body: () => Promise<void>): Promise<string[]> {
    const lines: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      await body();
    } finally {
      process.stdout.write = original;
    }
    return lines;
  }
}

const scenarios = new ReadoutScenarios();

test('followed stream includes assignments admitted after the run started', () =>
  scenarios.lateAssignment());

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
