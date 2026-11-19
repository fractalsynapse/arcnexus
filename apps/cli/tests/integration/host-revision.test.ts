import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { architecturePlugin } from '../../../../packages/architecture/src/index.js';
import { agentPlugin } from '../../../../packages/agent/src/index.js';
import { HostTask } from '../../../../packages/execution/src/index.js';
import type { Feedback, Plan } from '../../../../packages/direction/src/index.js';
import type { WorkflowServices } from '../../../../packages/workflow/src/index.js';
import { mountTaskHost } from '../../src/host.js';

const plan: Plan = {
  focus: { purpose: 'Goal', objectives: ['Outcome'], constraints: ['Scope'] },
  milestones: Array.from({ length: 121 }, (_, index) => ({
    id: `milestone-${index}`,
    owner: 'work',
    criteria: [{ id: `criterion-${index}`, description: `Accepted outcome ${index}` }],
    steps: [],
  })),
};
const position = { completed: 120, activities: { 'milestone-120': 2 } };
const observations = [
  { plan },
  { check: { status: 1, log: 'retained failure' } },
  { activation: { outcome: { kind: 'completed', answer: 'The complete supplier answer' } } },
  { position },
];

/** Mount the production adapter and capture the native Director activation. */
async function fixture(t: TestContext, retained: readonly unknown[] = observations) {
  const storage = mkdtempSync(join(tmpdir(), 'arcnexus-host-revision-'));
  t.after(() => rmSync(storage, { recursive: true, force: true }));
  const context = new Context();
  await context.use(architecturePlugin);
  await context.use(agentPlugin);
  await mountTaskHost(context);
  const direction = (context.workflow as unknown as { services: WorkflowServices }).services.direction;
  let activation: Record<string, unknown> | undefined;
  let sequence = 0;
  const session = Object.create(HostTask.prototype) as HostTask;
  Object.assign(session, {
    capture: { project: { director: { component: 'director', activity: 'planning' } } },
    evidence: [],
    observations: () => structuredClone(observations),
    store: (name: string, contents: string) => {
      const path = join(storage, `${++sequence}-${name}`);
      writeFileSync(path, contents, { flag: 'wx' });
      return path;
    },
    activate: (_agent: unknown, _selection: unknown, data: Record<string, unknown>) => {
      activation = data;
      return Promise.resolve({ kind: 'plan', plan: { milestones: [] } });
    },
  });
  return {
    direction,
    session,
    activation: () => {
      assert(activation);
      return activation;
    },
  };
}

const findings: Feedback[] = [
  {
    kind: 'supplier',
    milestone: 'supplier',
    requester: 'milestone-120',
    owner: 'supplier-owner',
    reason: 'An adapter is needed',
    evidence: ['failure.log'],
  },
  {
    kind: 'rejection',
    findings: [{ criterion: 'criterion-0', owner: 'work', reason: 'Failed', evidence: ['review'] }],
  },
];

for (const finding of findings) {
  test(`host gives Director a bounded snapshot for ${finding.kind}`, async (t) => {
    const host = await fixture(t);
    try {
      await host.direction.revise(host.session, plan, finding, new AbortController().signal);
    } catch {
      // The fake response need not pass Direction's plan validation.
    }
    const data = host.activation();
    const request = data.milestone as {
      acceptedPlan: string;
      retainedEvidence: string;
      position: typeof position;
      finding: Feedback;
    };
    assert.equal(typeof request.acceptedPlan, 'string');
    assert.equal(typeof request.retainedEvidence, 'string');
    assert.deepEqual(JSON.parse(readFileSync(request.acceptedPlan, 'utf8')), plan);
    assert.deepEqual(JSON.parse(readFileSync(request.retainedEvidence, 'utf8')), observations);
    assert.deepEqual(request.position, position);
    assert.deepEqual(request.finding, finding);
    assert(!JSON.stringify(data).includes('Accepted outcome 0'));
    const acceptedBytes = readFileSync(request.acceptedPlan, 'utf8');
    const evidenceBytes = readFileSync(request.retainedEvidence, 'utf8');
    try {
      await host.direction.revise(host.session, plan, finding, new AbortController().signal);
    } catch {
      // The second activation must leave the first snapshot intact.
    }
    assert.equal(readFileSync(request.acceptedPlan, 'utf8'), acceptedBytes);
    assert.equal(readFileSync(request.retainedEvidence, 'utf8'), evidenceBytes);
  });
}

test('initial planning and invalid-response repair retain their planning context', async (t) => {
  const host = await fixture(t);
  const signal = new AbortController().signal;
  await host.direction.plan(host.session, signal);
  assert.equal(host.activation().milestone, 'Initial planning');
  const feedback = { kind: 'plan-repair' as const, diagnostic: 'Invalid response' };
  await host.direction.revise(host.session, undefined, feedback, signal);
  const activation = host.activation();
  assert.equal(activation.milestone, 'Initial planning');
  assert.deepEqual((activation.assignment as { feedback: Feedback }).feedback, feedback);
});
