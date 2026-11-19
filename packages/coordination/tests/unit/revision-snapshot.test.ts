import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Coordination, revisionSnapshot } from '../../src/index.js';
import { HostTask } from '../../../execution/src/index.js';

test('a first-activity escalation starts at the initial position', () => {
  const plan = { milestones: [{ id: 'pending' }] };
  const snapshot = revisionSnapshot([{ plan }, { feedback: { kind: 'supplier' } }]);
  assert.deepEqual(snapshot.plan, plan);
  assert.deepEqual(snapshot.position, { completed: 0, activities: {} });
});

test('a planner refresh cannot inherit an obsolete position', () => {
  const plan = { milestones: [{ id: 'new' }] };
  const observations = [
    { plan: { milestones: [{ id: 'old' }] } },
    { position: { completed: 1, activities: { old: 2 } } },
    { plannerRefresh: 'new inventory' },
    { plan },
    { feedback: { kind: 'supplier' } },
  ];
  const snapshot = revisionSnapshot(observations);
  assert.deepEqual(snapshot.plan, plan);
  assert.deepEqual(snapshot.position, { completed: 0, activities: {} });
  assert.deepEqual(snapshot.observations, observations);
});

test('host storage preserves exact snapshot bytes after subsequent observations', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'coordination-artifact-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = 'https://example.invalid/repo.git';
  const journal = new Coordination(directory).admit(remote, 'goal');
  assert('record' in journal);
  t.after(() => journal.close());
  const config = { storage: directory, capture: { source: { remote } } } as ConstructorParameters<
    typeof HostTask
  >[0];
  const host = new HostTask(config, 'goal', journal);
  host.note({
    plan: { milestones: [{ id: 'done', criteria: [{ id: 'A', description: 'original' }] }] },
  });
  host.note({ position: { completed: 1, activities: { done: 1 } } });
  host.note({ check: { status: 'failed', log: 'failure.log' } });
  host.note({ feedback: { answer: 'complete answer' } });
  const snapshot = revisionSnapshot(host.observations());
  const planBytes = JSON.stringify(snapshot.plan);
  const evidenceBytes = JSON.stringify(snapshot.observations);
  const planRef = host.store('plan.json', planBytes);
  const evidenceRef = host.store('evidence.json', evidenceBytes);
  host.note({ feedback: { kind: 'rejection', findings: ['later'] } });
  assert.notEqual(planRef, evidenceRef);
  assert.equal(readFileSync(planRef, 'utf8'), planBytes);
  assert.equal(readFileSync(evidenceRef, 'utf8'), evidenceBytes);
  assert.deepEqual(JSON.parse(readFileSync(evidenceRef, 'utf8')), snapshot.observations);
  assert.match(evidenceBytes, /failure.log/);
  assert.match(evidenceBytes, /complete answer/);
});

test('revision snapshot selects the accepted plan and committed position after planner refresh', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'coordination-revision-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Coordination(directory);
  const remote = 'https://example.invalid/repo.git';
  const first = store.admit(remote, 'goal');
  assert('record' in first);
  first.record({ plan: { milestones: [{ id: 'obsolete' }] } });
  first.record({ position: { completed: 1, activities: { obsolete: 2 } } });
  first.record({ plannerRefresh: 'new inventory' });
  const plan = {
    milestones: [
      {
        id: 'done',
        owner: 'coordination',
        criteria: [{ id: 'A', description: 'original' }],
        steps: [{ activity: 'testing' }],
      },
      {
        id: 'pending',
        owner: 'direction',
        criteria: [{ id: 'B', description: 'retained' }],
        steps: [{ activity: 'documentation' }, { activity: 'testing' }],
      },
    ],
  };
  first.record({ plan });
  first.record({ position: { completed: 1, activities: { done: 1, pending: 1 } } });
  first.record({ check: { id: 'owner-tests', status: 'failed', log: 'failure.log' } });
  first.finish({ kind: 'cancelled', evidence: ['failure.log'] });
  first.close();

  const retry = store.admit(remote, 'goal');
  assert('record' in retry);
  t.after(() => retry.close());
  const answer = { kind: 'answer', question: 'why?', answer: 'The full retained answer.' };
  retry.record({ feedback: answer });
  const observations = [...(retry.retained?.events ?? []), ...retry.events()];
  const snapshot = revisionSnapshot(observations);
  assert.deepEqual(snapshot.plan, plan);
  assert.deepEqual(snapshot.position, { completed: 1, activities: { done: 1, pending: 1 } });
  assert.deepEqual(snapshot.observations, observations);
  assert(
    snapshot.observations.some((event: unknown) => JSON.stringify(event).includes('failure.log')),
  );
  assert(
    snapshot.observations.some((event: unknown) => JSON.stringify(event).includes(answer.answer)),
  );
});

test('a captured revision snapshot is detached from later writes and caller mutation', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'coordination-snapshot-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const journal = new Coordination(directory).admit('https://example.invalid/repo.git', 'goal');
  assert('record' in journal);
  t.after(() => journal.close());
  const plan = { milestones: [{ id: 'done', criteria: [{ id: 'A', description: 'original' }] }] };
  journal.record({ plan });
  journal.record({ position: { completed: 1, activities: { done: 1 } } });
  const observations = journal.events();
  const snapshot = revisionSnapshot(observations);
  const bytes = JSON.stringify(snapshot);
  journal.record({ feedback: { kind: 'rejection', findings: ['later'] } });
  (
    observations[0] as typeof plan & { plan: typeof plan }
  ).plan.milestones[0]!.criteria[0]!.description = 'changed';
  assert.equal(JSON.stringify(snapshot), bytes);
  (snapshot.plan as typeof plan).milestones[0]!.criteria[0]!.description = 'caller mutation';
  assert.deepEqual(journal.events()[0], { plan });
});
