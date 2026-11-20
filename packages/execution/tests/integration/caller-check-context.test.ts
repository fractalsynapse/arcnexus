import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';
import { contextEvidence } from '../fixtures/context-evidence.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Reproduce a newer MCP observation arriving before the same caller repairs an invalid reply. */
class CallerCheckContext {
  private readonly task;
  private readonly logs: string[] = [];
  private calls = 0;

  /** Seed an old failure and record newer observations at the public activation boundary. */
  constructor(
    t: TestContext,
    private readonly resolved: boolean,
  ) {
    this.task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-check-context-'))).task;
    t.after(() => this.task.close());
    this.observe(1, 'Old syntax failure');
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.reply(data),
    );
  }

  /** Require the same-caller retry to use current diagnostics, without erasing prior evidence. */
  private reply(data: TaskContext) {
    const assignment = data.assignment as {
      failedCheck?: { log: string; expected: string };
      responseRepair?: string;
    };
    this.calls++;
    if (this.calls === 1) {
      assert.equal(assignment.failedCheck?.log, this.logs[0]);
      this.observe(this.resolved ? 0 : 37, 'Current observation');
      return { kind: 'blocked', reason: 'Repair the ordinary defect' };
    }
    assert.match(assignment.responseRepair!, /ordinary defect/);
    if (this.resolved) assert.equal(assignment.failedCheck, undefined);
    else {
      assert.equal(assignment.failedCheck?.log, this.logs[1]);
      assert.equal(assignment.failedCheck?.expected, 'pass');
      this.observe(0, 'Corrected');
    }
    assert(contextEvidence(this.task, data).includes(this.logs[0]!));
    return { kind: 'completed', edits: [], checks: [] };
  }

  /** Retain actual check records through the existing journal rather than inventing caller context. */
  private observe(status: number, text: string) {
    const log = this.task.store('owner-tests.log', text);
    this.logs.push(log);
    this.task.note({
      check: {
        id: 'owner-tests',
        status,
        log,
        command: 'fixture',
        args: [],
        cwd: '.',
        durationMs: 0,
      },
      scope: { owner: 'owner', activity: 'implementation', expected: 'pass' },
    });
  }

  /** Exercise the public steward path and confirm both diagnostic generations remain readable. */
  async run() {
    const milestone: Milestone = {
      id: 'current',
      owner: 'owner',
      criteria: [{ id: 'criterion', description: 'Preserve acceptance' }],
      steps: activities.map((activity) => ({ activity, checklist: [] })),
    };
    const result = await steward(
      new Agent(new Architecture()),
      this.task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
    assert.equal(result.kind, 'completed');
    assert.equal(this.calls, 2);
    assert.equal(readFileSync(this.logs[0]!, 'utf8'), 'Old syntax failure');
    assert.equal(readFileSync(this.logs[1]!, 'utf8'), 'Current observation');
  }
}

test('caller reply recovery receives the newest pending check and preserves its expectation', async (t) => {
  await new CallerCheckContext(t, false).run();
});

test('caller reply recovery keeps a resolved check in history without obsolete repair instructions', async (t) => {
  await new CallerCheckContext(t, true).run();
});
