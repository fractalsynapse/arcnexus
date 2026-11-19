import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { ArchitectureFixture } from '../fixtures/architecture.js';
import type { HostTask } from '../../src/index.js';
import { Architecture } from '../../../architecture/src/index.js';

const signal = new AbortController().signal;

/** Exercise the public Architecture assessment with real journals and a deterministic actor response. */
class AssessmentFixture extends ArchitectureFixture {
  readonly architecture = new Architecture();
  readonly agent = new Agent(this.architecture);

  /** Start without a pending proposal so each scenario exercises real assessment admission. */
  constructor(t: TestContext) {
    super(t, false);
  }

  /** Return cited source whose original bytes are part of this explicit generic capture. */
  noChange() {
    return {
      kind: 'no-change',
      summary: 'The declared requirement is aligned.',
      evidence: [{ path: 'contract.md', quote: '| SERVICE-1 | Original requirement |' }],
    };
  }

  /** Use the public application operation with the actual admitted host task. */
  assess() {
    return this.architecture.propose(this.agent, this.parent, undefined, signal);
  }
}

test('Architect repairs an invalid no-change citation in the same caller without Direction', async (t) => {
  const fixture = new AssessmentFixture(t);
  const inputs: unknown[] = [];
  t.mock.method(
    fixture.parent,
    'activate',
    async (...[_agent, selection, data]: Parameters<HostTask['activate']>) => {
      assert.deepEqual(selection, { component: 'architecture', activity: 'updating' });
      inputs.push(data);
      return inputs.length === 1 ? { ...fixture.noChange(), evidence: [] } : fixture.noChange();
    },
  );
  const result = await fixture.assess();
  assert.equal(result.kind, 'no-change');
  assert.equal(inputs.length, 2);
  assert.match(JSON.stringify(inputs[1]), /requires a summary and source citations/);
  assert.equal(readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'), fixture.original);
  fixture.parent.cleanup();
});

test('pending Architect approval resumes the exact proposal without another actor call', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(fixture.parent, 'activate', async () => {
    calls++;
    return {
      kind: 'proposal',
      purpose: 'Add an invariant',
      consequences: ['A new requirement'],
      implementation: [],
      changes: [
        { path: 'contract.md', content: fixture.original + '| SERVICE-2 | New requirement |\n' },
      ],
    };
  });
  await assert.rejects(fixture.assess(), /Architecture proposal/);
  const pending = fixture.parent
    .observations<{ architectureProposal?: { proposal: { id: string } } }>()
    .findLast(({ architectureProposal }) => architectureProposal)?.architectureProposal;
  fixture.parent.ask = async () => 'approve';
  const result = await fixture.assess();
  assert.equal(result.kind, 'approved');
  if (result.kind === 'approved') assert.equal(result.proposal.id, pending?.proposal.id);
  assert.equal(calls, 1);
  assert.equal(readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'), fixture.original);
  fixture.parent.cleanup();
});

test('repeated unchanged Architect diagnostics hold durably instead of spinning', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(fixture.parent, 'activate', async () => {
    calls++;
    return { kind: 'invalid' };
  });
  await assert.rejects(fixture.assess(), /repeated an unchanged finding/);
  assert.equal(calls, 2);
  fixture.parent.cleanup();
});
