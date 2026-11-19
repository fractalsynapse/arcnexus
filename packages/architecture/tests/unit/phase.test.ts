import assert from 'node:assert/strict';
import test from 'node:test';
import { Architecture } from '../../src/index.js';

interface Proposal {
  id: string;
  purpose: string;
  consequences: string[];
  prerequisites: string[];
  baseline: string;
  files: { path: string; original: string; final: string; bytes: string }[];
}

interface Phase {
  assess(input: unknown): Promise<any>;
  resume(id: string): Promise<any>;
  decide(id: string, decision: unknown): Promise<any>;
  apply(id: string, input?: unknown): Promise<any>;
}

/** Provide an isolated public application fixture with recorded host observations. */
function fixture(assessment?: unknown) {
  const sources = {
    objectives: 'approved objective',
    goals: 'approved goal',
    architecture: 'captured architecture',
    implementation: 'current implementation',
    findings: ['retained finding'],
  };
  const proposal: Proposal = {
    id: 'proposal-1',
    purpose: 'Update the architecture',
    consequences: ['Change a contract'],
    prerequisites: ['Implement the capability'],
    baseline: 'revision-1',
    files: [{ path: 'contract.md', original: 'old', final: 'new', bytes: 'new bytes' }],
  };
  const journal = new Map<string, unknown>();
  const source = new Map([['contract.md', 'old bytes']]);
  const application = new Architecture() as unknown as {
    phase(input: unknown): Phase;
  };
  const phase = () =>
    application.phase({
      binding: { component: 'architecture', activity: 'updating' },
      sources,
      journal,
      source,
      activate: async () => assessment ?? { kind: 'proposal', proposal },
    });
  return { phase, proposal, sources, journal, source };
}

test('assessment selects the explicit architect and receives the approved evidence', async () => {
  const f = fixture();
  const result = await f.phase().assess({ feedback: 'focus' });
  assert.deepEqual(result.proposal, f.proposal);
  assert.deepEqual(result.inputs, f.sources);
  assert.deepEqual(result.selection, { component: 'architecture', activity: 'updating' });
  assert.equal(result.feedback, 'focus');
  assert.equal(f.source.get('contract.md'), 'old bytes');
});

test('a pending proposal and complete answers survive interruption', async () => {
  const f = fixture();
  const first = await f.phase().assess({ answers: { question: 'complete answer' } });
  const resumed = await f.phase().resume(first.proposal.id);
  assert.deepEqual(resumed.proposal, first.proposal);
  assert.deepEqual(resumed.answers, { question: 'complete answer' });
  assert.equal(resumed.status, 'pending');
});

test('only exact recorded human approval permits the reviewed batch', async () => {
  const f = fixture();
  await f.phase().assess({});
  await f.phase().decide(f.proposal.id, {
    kind: 'approved',
    delegation: 'trusted-host',
    proposal: f.proposal,
  });
  const result = await f.phase().apply(f.proposal.id);
  assert.equal(result.status, 'applied');
  assert.equal(f.source.get('contract.md'), 'new bytes');
});

for (const decision of [
  undefined,
  { kind: 'unknown' },
  { kind: 'declined' },
  { kind: 'approved', delegation: 'candidate' },
  { kind: 'approved', delegation: 'trusted-host', proposal: { id: 'other' } },
]) {
  test(`application refuses an untrusted decision: ${JSON.stringify(decision)}`, async () => {
    const f = fixture();
    await f.phase().assess({});
    if (decision) await f.phase().decide(f.proposal.id, decision);
    const result = await f.phase().apply(f.proposal.id);
    assert.notEqual(result.status, 'applied');
    assert.equal(f.source.get('contract.md'), 'old bytes');
  });
}

for (const alteration of ['baseline', 'intent', 'bytes', 'original', 'final']) {
  test(`application requires renewed review when ${alteration} changes`, async () => {
    const f = fixture();
    await f.phase().assess({});
    await f.phase().decide(f.proposal.id, {
      kind: 'approved',
      delegation: 'trusted-host',
      proposal: structuredClone(f.proposal),
    });
    const changed = structuredClone(f.proposal);
    if (alteration === 'baseline') changed.baseline = 'revision-2';
    if (alteration === 'intent') changed.purpose = 'Different purpose';
    if (alteration === 'bytes') changed.files[0]!.bytes = 'different bytes';
    if (alteration === 'original') changed.files[0]!.original = 'different original';
    if (alteration === 'final') changed.files[0]!.final = 'different final';
    const result = await f.phase().apply(f.proposal.id, { proposal: changed });
    assert.notEqual(result.status, 'applied');
    assert.equal(f.source.get('contract.md'), 'old bytes');
  });
}
