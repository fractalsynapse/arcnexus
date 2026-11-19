import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { validateVerdict, verify } from '../../src/index.js';

const assembled = [
  'repository-build', 'repository-types', 'repository-format', 'repository-lint', 'repository-tests',
];
const operations = ['owner-tests', 'owner-format'];
const plan: Plan = {
  focus: { purpose: 'Verify quality evidence', objectives: [], constraints: [] },
  milestones: [{
    id: 'quality', owner: 'verification',
    criteria: [{ id: 'V-1', description: 'Each operation has current evidence' }],
    steps: [{ activity: 'testing', checklist: [
      { id: 'V-T', criteria: ['V-1'], expected: 'Owner evidence is complete' },
    ] }],
  }],
};

for (const scenario of ['missing', 'unavailable', 'stale', 'other-owner', 'other-activity', 'valid'] as const) {
test(`assembled review handles ${scenario} owner-operation evidence`, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-verification-quality-'));
  const capture = {
    source: { root, revision: 'base', remote: 'https://example.com/quality.git' },
    project: {
      verifier: { component: 'reviewer', activity: 'assessment' },
      checks: { acceptance: assembled },
    },
    components: { verification: { activities: { testing: { operations } } } },
    operations: Object.fromEntries(operations.map((id) => [id, {
      id, kind: 'command', tool: 'check', category: 'test', command: '/usr/bin/true',
      args: [], cwd: '.', network: false,
    }])),
  } as unknown as Capture;
  const journal = new Coordination(root).admit(capture.source.remote, 'Quality evidence');
  assert('close' in journal);
  const task = new HostTask({
    capture, common: root, executable: '', base: 'staging', fresh: true, storage: root,
  }, 'Quality evidence', journal);
  t.after(() => {
    task.close();
    rmSync(root, { recursive: true, force: true });
  });
  const redLog = task.store('red.log', 'Expected failing regression');
  task.note({
    scope: { owner: 'verification', activity: 'testing', expected: 'fail' },
    check: { id: 'owner-tests', status: 1, command: 'test', args: [], cwd: root,
      durationMs: 1, log: redLog },
  });
  if (scenario !== 'missing') {
    const log = task.store('format.log', 'Format observation');
    task.note({
      scope: { owner: scenario === 'other-owner' ? 'other' : 'verification',
        activity: scenario === 'other-activity' ? 'implementation' : 'testing', expected: 'pass' },
      check: { id: 'owner-format', status: scenario === 'unavailable' ? null : 0,
        command: 'format', args: [], cwd: root, durationMs: 1, log },
    });
    if (scenario === 'stale') task.note({ edits: [{ path: 'source.ts' }] });
  }
  const calls: string[] = [];
  t.mock.method(task, 'check', async (id: string) => {
    calls.push(id);
    return { id, status: 0, command: 'check', args: [], cwd: root,
      durationMs: 1, log: task.store(id + '.log', 'passed') };
  });
  t.mock.method(task, 'activate', async (_agent: Agent, _selection: unknown, data: TaskContext) => {
    const ownerChecks = (data.assignment as { ownerChecks: unknown[] }).ownerChecks;
    assert.equal(ownerChecks.length, scenario === 'missing' ? 1 : 2);
    assert.equal((ownerChecks[0] as { check: { id: string } }).check.id, 'owner-tests');
    return { kind: 'accepted', candidate: 'tree', criteria: ['V-1'], evidence: [redLog] };
  });
  const verdict = await verify({} as Agent, task, plan,
    { digest: 'tree', evidence: [redLog] }, AbortSignal.timeout(5000));
  if (scenario === 'valid') assert.equal(verdict.kind, 'accepted');
  else assert.notEqual(verdict.kind, 'accepted', `owner-format evidence is ${scenario}`);
  assert.deepEqual(calls, assembled);
});
}

test('an independent verdict cannot follow a changed candidate', () => {
  const verdict = { kind: 'accepted' as const, candidate: 'old-tree',
    criteria: ['V-1'], evidence: ['review.log'] };
  assert.doesNotThrow(() => validateVerdict(plan, { digest: 'old-tree', evidence: [] }, verdict));
  assert.throws(
    () => validateVerdict(plan, { digest: 'new-tree', evidence: [] }, verdict),
    /different candidate/,
  );
});
