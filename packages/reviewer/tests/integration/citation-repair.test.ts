import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { verify } from '../../../verification/src/index.js';

const invalid = '../../evidence/candidate.diff';
const candidate = { digest: 'verified-tree', evidence: [] };
const plan: Plan = {
  focus: { purpose: 'Review the fixture', objectives: [], constraints: [] },
  milestones: [
    {
      id: 'change',
      owner: 'reviewer',
      criteria: [{ id: 'scope', description: 'Only the scoped change is staged' }],
      steps: [],
    },
  ],
};

/** Drive Verification and Reviewer against one journal and an explicit scripted decision. */
class CitationScenario {
  readonly task: HostTask;
  readonly requests: TaskContext[] = [];
  readonly checkLog: string;
  checks = 0;
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-citation-repair-'));

  /** Bind the fixture to one admitted run and one observed check. */
  constructor(
    t: TestContext,
    private readonly repair: 'valid' | 'invalid' | 'different' = 'valid',
  ) {
    this.task = this.admit();
    this.checkLog = this.task.store('check.log', 'Observed exit 0\n');
    t.after(() => {
      this.task.close();
      rmSync(this.root, { recursive: true, force: true });
    });
    t.mock.method(this.task, 'check', async (id: string) => {
      this.checks++;
      return {
        id,
        status: 0,
        command: 'fixture',
        args: [],
        cwd: this.root,
        durationMs: 1,
        log: this.checkLog,
      };
    });
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.respond(data),
    );
  }

  /** Open a real journal with only the authority required by the verification fixture. */
  private admit() {
    const capture = {
      source: {
        root: this.root,
        revision: 'captured',
        remote: 'https://example.com/citation-repair.git',
      },
      project: {
        verifier: { component: 'reviewer', activity: 'assessment' },
        checks: { acceptance: ['fixture'] },
      },
      operations: {},
    } as unknown as Capture;
    const journal = new Coordination(this.root).admit(capture.source.remote, 'Citation regression');
    assert('close' in journal);
    return new HostTask(
      {
        capture,
        common: this.root,
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.root,
      },
      'Citation regression',
      journal,
    );
  }

  /** Start with an invalid reference and supply the configured repair on a second call. */
  private respond(data: TaskContext) {
    this.requests.push(data);
    const repairing = this.requests.length > 1;
    return {
      kind: 'accepted',
      candidate: repairing && this.repair === 'different' ? 'other-tree' : candidate.digest,
      criteria: ['scope'],
      evidence: [repairing && this.repair !== 'invalid' ? this.checkLog : invalid],
    };
  }

  /** Use the normal Verification call so a repeated check would be observable. */
  run() {
    return verify({} as Agent, this.task, plan, candidate, AbortSignal.timeout(5000));
  }
}

test('Reviewer repairs an invalid citation on the same candidate and original checklist', async (t) => {
  const fixture = new CitationScenario(t);
  const verdict = await fixture.run();
  assert.deepEqual(verdict, {
    kind: 'accepted',
    candidate: candidate.digest,
    criteria: ['scope'],
    evidence: [fixture.checkLog],
  });
  assert.equal(fixture.checks, 1);
  assert.equal(fixture.requests.length, 2);
  const [first, second] = fixture.requests;
  const { citationRepair, ...reused } = second?.assignment as Record<string, unknown>;
  assert.deepEqual(reused, first?.assignment);
  assert.deepEqual(second?.acceptance, first?.acceptance);
  assert(JSON.stringify(citationRepair).includes(invalid));
  assert(JSON.stringify(citationRepair).includes('retained evidence'));
  assert(second?.evidence?.includes(fixture.checkLog));
});

test('a second invalid citation and a changed candidate each fail the same gate', async (t) => {
  for (const repair of ['invalid', 'different'] as const) {
    const fixture = new CitationScenario(t, repair);
    await assert.rejects(fixture.run(), repair === 'invalid' ? /retained evidence/ : /assessment/);
    assert.equal(fixture.requests.length, 2);
    assert.equal(fixture.checks, 1);
  }
});
