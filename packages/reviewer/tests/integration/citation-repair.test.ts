import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { AgentActivityHold, InvalidAgentResponse, type Agent } from '../../../agent/src/index.js';
import type { Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { verify } from '../../../verification/src/index.js';

export const suite = { owner: 'reviewer', level: 'integration', tags: ['regression'] } as const;

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

type RepairMode =
  'valid' | 'invalid' | 'different' | 'successive' | 'native' | 'changed-then-corrected';

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
    private readonly repair: RepairMode = 'valid',
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
    const visit = this.requests.length;
    if (this.repair === 'native' && visit === 1)
      throw new InvalidAgentResponse('Malformed native JSON');
    if (this.repair === 'successive' && visit <= 2)
      return {
        kind: 'accepted',
        candidate: candidate.digest,
        criteria: ['scope'],
        evidence: [`missing-${visit}.log`],
      };
    const repairing = visit > 1;
    return {
      kind: 'accepted',
      candidate:
        repairing &&
        (this.repair === 'different' || (this.repair === 'changed-then-corrected' && visit === 2))
          ? 'other-tree'
          : candidate.digest,
      criteria: ['scope'],
      evidence: [repairing && this.repair !== 'invalid' ? this.checkLog : invalid],
    };
  }

  /** Use the normal Verification call so a repeated check would be observable. */
  run() {
    return verify({} as Agent, this.task, plan, candidate, new AbortController().signal);
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
    await assert.rejects(fixture.run(), AgentActivityHold);
    assert.equal(fixture.requests.length, repair === 'invalid' ? 2 : 3);
    assert.equal(fixture.checks, 1);
  }
});

test('Reviewer repairs native JSON before citation validation without rerunning checks', async (t) => {
  const fixture = new CitationScenario(t, 'native');
  assert.equal((await fixture.run()).kind, 'accepted');
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.checks, 1);
  assert.match(JSON.stringify(fixture.requests[1]), /Malformed native JSON/);
});

test('Reviewer repairs successive distinct citation findings in the same assessment', async (t) => {
  const fixture = new CitationScenario(t, 'successive');
  assert.equal((await fixture.run()).kind, 'accepted');
  assert.equal(fixture.requests.length, 3);
  assert.equal(fixture.checks, 1);
  assert.match(JSON.stringify(fixture.requests[1]), /missing-1/);
  assert.match(JSON.stringify(fixture.requests[2]), /missing-2/);
});

test('Reviewer repairs a changed citation-only candidate while preserving the original verdict', async (t) => {
  const fixture = new CitationScenario(t, 'changed-then-corrected');
  const verdict = await fixture.run();
  assert.equal(verdict.kind, 'accepted');
  assert.equal(verdict.candidate, candidate.digest);
  assert.equal(fixture.requests.length, 3);
  assert.equal(fixture.checks, 1);
  assert.match(JSON.stringify(fixture.requests[2]), /different candidate/);
});
