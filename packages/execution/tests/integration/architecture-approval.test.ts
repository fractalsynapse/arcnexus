import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ArchitectureFixture } from '../fixtures/architecture.js';
import { applyArchitecture, approvedArchitecture } from '../../src/architecture-edits.js';
import { applyEdits } from '../../src/edits.js';
import { HostTask } from '../../src/index.js';
import { git } from '../../src/git.js';

const signal = new AbortController().signal;

test('protected edits require the exact human gate and cannot be granted by a candidate', async (t) => {
  const fixture = new ArchitectureFixture(t);
  const { child, proposal } = fixture;
  assert.throws(() => approvedArchitecture(child, proposal.id), /exact human approval/);
  assert.throws(
    () =>
      applyEdits(fixture.workspace, child.capture, 'service', [
        { path: 'contract.md', expected: null, content: 'forged' },
      ]),
    /Locked/,
  );
  child.note({ architectureDecision: { id: proposal.id, decision: 'approved' } });
  assert.throws(() => approvedArchitecture(child, proposal.id), /exact human approval/);
  await fixture.decide('skip');
  await assert.rejects(applyArchitecture(child, proposal.id, signal), /exact human approval/);
  assert.equal(readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'), fixture.original);
});

test('exact approved files use real protected checkpoints and repeated application does not write again', async (t) => {
  const fixture = new ArchitectureFixture(t);
  const { child, proposal } = fixture;
  await fixture.decide('approve');
  await applyArchitecture(child, proposal.id, signal);
  const head = git(fixture.workspace, 'rev-parse', 'HEAD');
  assert.equal(
    readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'),
    proposal.files.find(({ path }) => path === 'contract.md')!.content,
  );
  assert.equal(git(fixture.workspace, 'status', '--porcelain'), '');
  const writes = child.observations().length;
  await applyArchitecture(child, proposal.id, signal);
  assert.equal(git(fixture.workspace, 'rev-parse', 'HEAD'), head);
  assert.equal(child.observations().length, writes);
});

test('changed proposal bytes and baseline invalidate a genuine retained approval', async (t) => {
  const fixture = new ArchitectureFixture(t);
  await fixture.decide('approve');
  const report = fixture.parent.store('changed.md', 'Changed retained intent');
  fixture.proposal.purpose = 'Changed intent';
  fixture.parent.note({ architectureProposal: { proposal: fixture.proposal, report } });
  assert.throws(() => approvedArchitecture(fixture.child, fixture.proposal.id), /proposal changed/);
  fixture.proposal.purpose = 'Clarify the service';
  fixture.parent.note({ architectureProposal: { proposal: fixture.proposal, report } });
  const { child } = fixture;
  const changed = new HostTask(
    {
      ...child.config,
      capture: { ...child.capture, source: { ...child.capture.source, revision: '0'.repeat(40) } },
    },
    child.goal,
    child.journal,
    fixture.parent,
  );
  assert.throws(() => approvedArchitecture(changed, fixture.proposal.id), /baseline changed/);
});

test('changed protected preimages are refused before altering the affected file', async (t) => {
  const fixture = new ArchitectureFixture(t);
  await fixture.decide('approve');
  writeFileSync(join(fixture.workspace, 'contract.md'), 'Unexpected external change');
  await assert.rejects(applyArchitecture(fixture.child, fixture.proposal.id, signal), /Stale/);
  assert.equal(
    readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'),
    'Unexpected external change',
  );
});

test('unanswered approval retains the exact question and does not touch source', async (t) => {
  const fixture = new ArchitectureFixture(t);
  await assert.rejects(fixture.decide(), /Architecture proposal/);
  await fixture.decide('approve');
  assert.equal(
    approvedArchitecture(fixture.child, fixture.proposal.id).proposal.id,
    fixture.proposal.id,
  );
});
