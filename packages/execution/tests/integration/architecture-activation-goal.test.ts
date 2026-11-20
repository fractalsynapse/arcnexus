import assert from 'node:assert/strict';
import test from 'node:test';
import { Agent, type ActivationInput } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { ArchitectureFixture } from '../fixtures/architecture.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const selection = { component: 'service', activity: 'review' };
const context = { assignment: 'Perform the accepted milestone', acceptance: [], evidence: [] };
const signal = new AbortController().signal;
const assessment = 'Produce a review batch only. Do not implement or approve it.';

test('approved Architect child activates against delivery intent while retaining its canonical lookup', async (t) => {
  const fixture = new ArchitectureFixture(t, true, assessment);
  await fixture.decide('approve');
  fixture.parent.note({ architectureDelivery: fixture.proposal.id });
  const agent = new Agent(new Architecture());
  const goals: string[] = [];
  t.mock.method(agent, 'activate', async ({ task }: ActivationInput) => {
    assert(typeof task.goal === 'string');
    goals.push(task.goal);
    return { kind: 'completed' };
  });
  const identity = [fixture.child.taskID, fixture.child.goalID];
  await fixture.child.activate(agent, selection, context, signal);
  assert.equal(goals.length, 1);
  assert.notEqual(goals[0], assessment);
  assert(goals[0]!.includes(fixture.proposal.purpose));
  assert.equal(fixture.child.goal, assessment);
  assert.deepEqual([fixture.child.taskID, fixture.child.goalID], identity);
});

test('ordinary activation retains its exact supplied goal despite a pending proposal elsewhere', async (t) => {
  const fixture = new ArchitectureFixture(t, true, assessment);
  const agent = new Agent(new Architecture());
  t.mock.method(agent, 'activate', async ({ task }: ActivationInput) => {
    assert.equal(task.goal, assessment);
    return { kind: 'completed' };
  });
  await fixture.child.activate(agent, selection, context, signal);
});

test('candidate permission claims and declined approval cannot supply an Architect delivery goal', async (t) => {
  const fixture = new ArchitectureFixture(t, true, assessment);
  const agent = new Agent(new Architecture());
  fixture.parent.note({ architectureDelivery: fixture.proposal.id });
  fixture.child.note({ architectureDecision: { id: fixture.proposal.id, decision: 'approved' } });
  let calls = 0;
  t.mock.method(agent, 'activate', async () => {
    calls++;
    return { kind: 'completed' };
  });
  await assert.rejects(
    async () => fixture.child.activate(agent, selection, context, signal),
    /exact human approval/,
  );
  await fixture.decide('skip');
  await assert.rejects(
    async () => fixture.child.activate(agent, selection, context, signal),
    /exact human approval/,
  );
  assert.equal(calls, 0);
});
