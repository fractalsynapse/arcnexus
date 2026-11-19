import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent, type ActivationInput } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;
const answer = '  Preserve the complete approved answer.\n';
const report = {
  kind: 'research-report',
  summary: 'Existing behavior is documented',
  findings: answer,
  sources: [{ url: 'https://example.com/api', note: 'Fixture source' }],
  applicability: 'Fixture only',
  unresolved: [],
  reusable: false,
};

interface CallerAssignment {
  failedCheck?: { log: string; expected: string };
  correction?: string;
  clarifications?: { answer: string }[];
  researchResults?: { evidence: string }[];
}

/** Change a check before a real inbox handoff and inspect the resumed public steward context. */
class InboxCheckContext {
  private readonly task;
  private readonly agent = new Agent(new Architecture());
  private readonly logs: string[] = [];
  private calls = 0;

  /** Keep one real journal and mock only provider answers and their observed check results. */
  constructor(
    t: TestContext,
    private readonly mode: 'research' | 'question',
    private readonly resolved: boolean,
  ) {
    this.task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-inbox-context-'))).task;
    execFileSync('git', ['init', '-q', this.task.capture.source.root]);
    Object.assign(this.task.capture.source, { paths: [], revision: 'fixture' });
    this.task.capture.components.owner!.activities.research = {
      profile: 'fixture',
      operations: [],
      instructions: [],
      standards: [],
      role: 'researcher',
    };
    this.task.ask = async () => answer;
    t.after(() => this.task.close());
    this.observe(1, 'Original failure');
    t.mock.method(this.agent, 'activate', async (input: ActivationInput) => this.reply(input));
  }

  /** Supply research separately and require the original actor to receive the newest check. */
  private reply({ selection, task }: ActivationInput) {
    if (selection.activity === 'research') {
      assert(
        task.evidence?.includes(this.logs[1]!),
        'Research must see the current check reference',
      );
      return report;
    }
    const assignment = task.assignment as CallerAssignment;
    if (++this.calls === 1) {
      assert.equal(assignment.failedCheck?.log, this.logs[0]);
      this.observe(this.resolved ? 0 : 37, 'Newest observation');
      return {
        kind: this.mode,
        question: 'Which behavior applies?',
        decision: 'Resolve current repair',
      };
    }
    if (this.resolved) {
      assert.equal(assignment.failedCheck, undefined);
      assert.equal(assignment.correction, undefined);
    } else {
      assert.equal(assignment.failedCheck?.log, this.logs[1]);
      assert.equal(assignment.failedCheck?.expected, 'pass');
      this.observe(0, 'Repaired');
    }
    this.verifyAnswer(assignment);
    return { kind: 'completed', edits: [], checks: [] };
  }

  /** Verify the complete answer survives the context refresh alongside retained check evidence. */
  private verifyAnswer(assignment: CallerAssignment) {
    if (this.mode === 'question') assert.equal(assignment.clarifications?.[0]?.answer, answer);
    else
      assert.match(
        readFileSync(assignment.researchResults?.[0]?.evidence ?? '', 'utf8'),
        /Preserve the complete approved answer/,
      );
    assert.equal(readFileSync(this.logs[0]!, 'utf8'), 'Original failure');
    assert.equal(readFileSync(this.logs[1]!, 'utf8'), 'Newest observation');
  }

  /** Use append-only actual check observations so the pending-check resolver remains real. */
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

  /** Exercise the real Steward, Clarifications, ResearchInbox and shared Agent activation path. */
  async run() {
    const milestone: Milestone = {
      id: 'current',
      owner: 'owner',
      criteria: [{ id: 'scope', description: 'Preserve acceptance' }],
      steps: activities.map((activity) => ({ activity, checklist: [] })),
    };
    assert.equal(
      (await steward(this.agent, this.task, milestone, 'implementation', AbortSignal.timeout(5000)))
        .kind,
      'completed',
    );
    assert.equal(this.calls, 2);
  }
}

for (const mode of ['research', 'question'] as const) {
  for (const resolved of [false, true]) {
    test(`${mode} continuation refreshes the caller check; resolved=${resolved}`, async (t) => {
      await new InboxCheckContext(t, mode, resolved).run();
    });
  }
}
