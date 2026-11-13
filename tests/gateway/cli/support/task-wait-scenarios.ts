import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { ExecutionAssignment } from '../../../../dist/library/coordination-store/execution-types.js';
import { RunQueryFixture } from './run-query-fixture.js';

/** Exercises terminal wait presentation through the built CLI and production store API. */
export class TaskWaitScenarios {
  /** Requires stable ordering across owners, assignments and waits while retaining resolved history. */
  outstanding(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const { run, waits, history } = this.outstandingState(f);
    const report = f.value('task', 'get', run.id);
    const expected = this.summary(waits);
    const database = join(f.state, 'projects/first/execution.sqlite');
    const before = readFileSync(database);
    this.resolvedHistory(report, history.id, 'Earlier answer', 4);

    // A single read prints the report document with its outstanding waits in stable
    // owner/assignment/escalation order - the guarantee this scenario exists to pin.
    assert.equal(
      this.terminal(f, run.id),
      JSON.stringify(report, null, 2) + '\n\n' + expected,
      'task status lists outstanding waits in stable owner/assignment/escalation order',
    );
    this.assertStreamedReadout(f, run.id);
    assert.deepEqual(readFileSync(database), before, 'task observation leaves storage unchanged');
  }

  /** Pins terminal bytes when only unrelated tasks or projects have outstanding waits. */
  absent(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const { run } = this.seed(f);
    const other = this.seed(f);
    this.open(f, other.run.id, other.assignments[0]!, 'Another task wait');
    const foreign = this.seed(f, 'second');
    this.open(f, foreign.run.id, foreign.assignments[0]!, 'Another project wait', 2, 'second');
    const report = f.value('task', 'get', run.id);
    assert.equal(
      this.terminal(f, run.id),
      JSON.stringify(report, null, 2) + '\n',
      'task status without waits preserves existing terminal bytes',
    );
    assert.equal(Object.hasOwn(report.counts, 'outstandingEscalations'), false);
  }

  /** Keeps resolved status and resolution visible without adding an empty outstanding summary. */
  resolved(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const { run, assignments } = this.seed(f);
    const wait = this.open(f, run.id, assignments[0]!, 'Waiting on report API');
    const writer = f.store();
    writer.escalations.close(wait.id, 'Report API delivered');
    writer.close();
    const report = f.value('task', 'get', run.id);
    this.resolvedHistory(report, wait.id, 'Report API delivered', 0);
    assert.equal(
      this.terminal(f, run.id),
      JSON.stringify(report, null, 2) + '\n',
      'resolved-only task status preserves existing terminal bytes',
    );
  }

  /** Creates unsorted waits plus resolved history, including quoted and multiline reason text. */
  private outstandingState(f: RunQueryFixture) {
    const { run, assignments } = this.seed(f);
    const alpha = assignments.slice(1).sort((a, b) => a.id.localeCompare(b.id));
    const zeta = this.open(f, run.id, assignments[0]!, 'Waiting on zeta service', 1);
    const laterAlpha = this.open(f, run.id, alpha[1]!, 'Waiting on alpha service', 3);
    const first = this.open(f, run.id, alpha[0]!, 'Waiting on first answer');
    const second = this.open(f, run.id, alpha[0]!, 'Waiting on "quoted"\nsecond answer');
    const history = this.open(f, run.id, alpha[0]!, 'Earlier wait');
    const writer = f.store();
    writer.escalations.close(history.id, 'Earlier answer');
    writer.close();
    const sameAssignment = [first, second].sort((a, b) => a.id.localeCompare(b.id));
    return { run, waits: [...sameAssignment, laterAlpha, zeta], history };
  }

  /** Seeds multiple accountable assignments and a terminal run so follow exits deterministically. */
  private seed(f: RunQueryFixture, project = 'first') {
    const store = f.store(project);
    try {
      const run = store.createRun('task', ['zeta', 'alpha'], 'Inspect task waits');
      const assignments = ['zeta', 'alpha', 'alpha'].map((owner) =>
        store.enqueue(run.id, owner, 'Owned wait presentation'),
      );
      store.updateRun(run.id, 'completed');
      return { run, assignments };
    } finally {
      store.close();
    }
  }

  /** Records actual escalation facts through the coordination store's public surface. */
  private open(
    f: RunQueryFixture,
    runId: string,
    assignment: ExecutionAssignment,
    reason: string,
    count = 2,
    project = 'first',
  ) {
    const store = f.store(project);
    try {
      return store.escalations.open({
        runId,
        assignmentId: assignment.id,
        owner: assignment.owner,
        goal: { objective: assignment.objective, acceptance: assignment.acceptance },
        openSteps: Array.from({ length: count }, (_, index) => ({
          id: 'step-' + index,
          activity: 'implementation',
          status: 'pending',
        })),
        evidence: [],
        reason,
      });
    } finally {
      store.close();
    }
  }

  /** Following is the streaming readout: the same stored sequence as one JSON object per line. */
  private assertStreamedReadout(f: RunQueryFixture, id: string): void {
    const streamed = this.terminal(f, id, true)
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line));
    assert.ok(streamed.length > 0, 'following emits the stored events');
    assert.deepEqual(
      streamed.map((event) => event.sequence),
      streamed.map((_, index) => index + 1),
    );
    assert.ok(
      streamed.every((event) => event.id === id || event.runId === id),
      'every streamed line belongs to the observed run',
    );
  }

  /** Invokes the existing report read with terminal formatting and optional observation. */
  private terminal(f: RunQueryFixture, id: string, follow = false): string {
    const result = spawnSync(
      process.execPath,
      [f.cli, 'task', 'get', id, ...(follow ? ['--follow'] : [])],
      {
        cwd: f.root,
        env: f.env,
        encoding: 'utf8',
        timeout: 15000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }

  /** States the documented field order for an already ordered set of recorded waits. */
  private summary(
    waits: Array<{
      owner: string;
      assignmentId: string;
      reason: string;
      openSteps: unknown[];
    }>,
  ): string {
    const lines = waits.map(
      (wait) =>
        '- owner=' +
        wait.owner +
        '; assignment=' +
        wait.assignmentId +
        '; reason=' +
        JSON.stringify(wait.reason) +
        '; open steps=' +
        wait.openSteps.length,
    );
    return 'Outstanding waits (' + waits.length + '):\n' + lines.join('\n') + '\n';
  }

  /** Verifies resolved history and counts independently of terminal summary formatting. */
  private resolvedHistory(report: any, id: string, resolution: string, outstanding: number): void {
    const history = report.assignments.flatMap((assignment: any) => assignment.escalations ?? []);
    assert.equal(history.find((wait: any) => wait.id === id)?.status, 'resolved');
    assert.equal(history.find((wait: any) => wait.id === id)?.resolution, resolution);
    assert.equal(report.counts.outstandingEscalations, outstanding);
    assert.equal(report.counts.resolvedEscalations, 1);
  }
}
