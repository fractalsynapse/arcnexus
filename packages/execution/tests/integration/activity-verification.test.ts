import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';
import { ArchitectVerificationFixture, selection } from '../fixtures/architect-verification.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const milestone: Milestone = {
  id: 'required-checks',
  owner: 'owner',
  criteria: [{ id: 'works', description: 'Required verification passes' }],
  steps: activities.map((activity) => ({ activity, checklist: [] })),
};

/** Exercise host completion checks with explicit controlled model/check boundaries and real journal evidence. */
class VerificationScenario {
  readonly task: StewardFixture['task'];
  readonly checks: string[] = [];

  /** Model a completion claim that omits its required operation; no native pass is simulated here. */
  constructor(t: TestContext, status: number, diagnostic?: string) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-activity-verification-'));
    this.task = new StewardFixture(t, root).task;
    t.after(() => this.task.close());
    Object.assign(this.task.capture.components.owner!.activities.implementation!, {
      verification: ['owner-tests'],
    });
    t.mock.method(this.task, 'activate', async () => ({
      kind: 'completed',
      edits: [],
      checks: [],
    }));
    this.observeChecks(t, status, diagnostic);
  }

  /** Record the controlled command exit separately from any scope-validation diagnostic. */
  private observeChecks(t: TestContext, status: number, diagnostic?: string) {
    t.mock.method(this.task, 'check', async (id: string, _signal: AbortSignal, scope: unknown) => {
      this.checks.push(id);
      const log = this.task.store(
        'controlled-verification.log',
        diagnostic ?? (status ? 'Required assertion failed' : 'Passed'),
      );
      const check = {
        id,
        command: 'controlled',
        args: [],
        cwd: this.task.worktree!,
        durationMs: 0,
        log,
        status,
        diagnostic,
      };
      this.task.note({ check, scope });
      return check;
    });
  }

  /** Run the real steward completion path against the accepted scoped milestone. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
  }
}

test('EX-27: host runs declared activity verification before accepting an omitted check', async (t) => {
  const scenario = new VerificationScenario(t, 0);
  assert.equal((await scenario.run()).kind, 'completed');
  assert.deepEqual(scenario.checks, ['owner-tests']);
});

test('EX-27: failed required verification returns to the same steward without a completion claim', async (t) => {
  const scenario = new VerificationScenario(t, 1);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'repair');
  assert.equal(outcome.kind === 'repair' && outcome.activity, 'implementation');
  assert.deepEqual(scenario.checks, ['owner-tests']);
});

test('required-pass verification cannot be weakened by an expected-fail tool request', async (t) => {
  const scenario = new VerificationScenario(t, 1);
  const tools = new ActivationTools(
    scenario.task,
    { component: 'owner', activity: 'implementation' },
    { milestone },
    new AbortController().signal,
  );
  await assert.rejects(
    tools.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'fail' }),
    /owner-tests.*requires.*pass/i,
  );
  assert.deepEqual(scenario.checks, []);
});

test('a successful process exit with invalid scope returns to its same steward for repair', async (t) => {
  const scenario = new VerificationScenario(t, 0, 'Quality selection binding mismatch');
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'repair');
  assert.equal(outcome.kind === 'repair' && outcome.activity, 'implementation');
  assert.match(outcome.kind === 'repair' ? outcome.reason : '', /selection binding mismatch/);
});

test('Architect supplier handoff preserves the request without claiming required verification', async (t) => {
  const fixture = new ArchitectVerificationFixture(t);
  const task = await fixture.open();
  const request = {
    kind: 'supplier',
    owner: 'work',
    milestone: 'distinct-prerequisite',
    reason: 'A distinct public contribution is required.',
    question: 'Provide the missing behavior.',
  };
  t.mock.method(fixture.agent, 'activate', async () => request);
  const reply = await task.activate(fixture.agent, selection, {}, new AbortController().signal);
  assert.deepEqual(reply, request);
  assert(!task.observations<{ check?: unknown }>().some((event) => event.check));
});
