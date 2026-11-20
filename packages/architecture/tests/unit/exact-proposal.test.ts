import assert from 'node:assert/strict';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { textDigest } from '../../../foundation/src/index.js';
import type { Capture } from '../../src/index.js';
import { prepareArchitectureProposal } from '../../src/decode-proposal.js';

export const suite = { owner: 'architecture', level: 'unit', tags: ['regression'] } as const;

const original = '# Contract\n\n| FIX-1 | Existing outcome |\n';
const changed = original + '| FIX-2 | Additional approved outcome |\n';

/** Supply explicit generic captured bytes without consulting or editing the real project. */
class ProposalFixture {
  readonly capture: Capture;
  readonly request = {
    purpose: 'Clarify a required outcome',
    consequences: ['The next capture includes the new outcome'],
    implementation: [],
    changes: [{ path: 'contracts/service.md', content: changed }],
  };

  /** Retain source registry history and its original ownership and stage for exact amendment tests. */
  constructor(stage = 'locked') {
    const contract = ProposalFixture.contract(stage);
    const registry = stringify({
      schemaVersion: 1,
      authority: { lockOwner: 'Fixture architect' },
      contracts: [contract],
    });
    this.capture = {
      source: {
        revision: '1'.repeat(40),
        paths: ['registry.yaml', contract.file],
        read: (path: string) => (path === 'registry.yaml' ? registry : original),
      },
      project: {
        contractRegistry: 'registry.yaml',
        architect: { component: 'architecture', activity: 'updating' },
      },
      components: {
        architecture: {
          id: 'architecture',
          owns: ['docs/interface', '.arc/architecture'],
          activities: {},
        },
      },
      contracts: [contract],
    } as unknown as Capture;
  }

  /** Construct generic historical metadata whose preservation is observable in the proposed registry. */
  private static contract(stage: string) {
    return {
      id: 'service',
      file: 'contracts/service.md',
      owner: 'service',
      stage,
      digest: textDigest(original),
      acceptedBy: 'Fixture architect',
      acceptedAt: '2026-01-01',
      scenarios: 1,
      history: [{ note: 'Retained earlier acceptance' }],
    };
  }
}

test('exact contract proposals derive registry bytes and preserve prior stage and history', () => {
  const fixture = new ProposalFixture();
  const proposal = prepareArchitectureProposal(fixture.capture, fixture.request);
  const amendment = proposal.files.find(({ path }) => path === 'registry.yaml');
  assert(amendment?.content);
  const entry = parse(amendment.content).contracts[0];
  assert.equal(entry.stage, 'locked');
  assert.equal(entry.digest, textDigest(changed));
  assert.equal(entry.scenarios, 2);
  assert.equal(entry.history[0].note, 'Retained earlier acceptance');
  assert.equal(entry.history[1].digest, textDigest(original));
  assert.equal(entry.history[1].acceptedBy, 'Fixture architect');
  assert.equal(entry.history[1].revision, fixture.capture.source.revision);
  assert.equal(
    proposal.files.find(({ path }) => path === 'contracts/service.md')?.before,
    original,
  );
});

test('proposal identity binds exact bytes, intent and baseline rather than a model identity', () => {
  const fixture = new ProposalFixture();
  const first = prepareArchitectureProposal(fixture.capture, { ...fixture.request, id: 'forged' });
  const next = prepareArchitectureProposal(fixture.capture, {
    ...fixture.request,
    purpose: 'Different intent',
  });
  assert.notEqual(first.id, 'forged');
  assert.notEqual(first.id, next.id);
  assert.throws(
    () =>
      prepareArchitectureProposal(fixture.capture, { ...fixture.request, baseline: 'different' }),
    /baseline/,
  );
});

test('registry amendment retains a proposed contract stage', () => {
  const fixture = new ProposalFixture('proposed');
  const proposal = prepareArchitectureProposal(fixture.capture, fixture.request);
  const amendment = proposal.files.find(({ path }) => path === 'registry.yaml');
  assert(amendment?.content);
  assert.equal(parse(amendment.content).contracts[0].stage, 'proposed');
  assert.equal(fixture.capture.contracts[0]!.stage, 'proposed');
});

for (const path of [
  '../outside.md',
  '.arc/architecture/../outside.yaml',
  'packages/service/src/code.ts',
  'AGENTS.md',
  'registry.yaml',
]) {
  test(`refuse unapproved path classes and separately authored registry bytes: ${path}`, () => {
    const fixture = new ProposalFixture();
    assert.throws(() =>
      prepareArchitectureProposal(fixture.capture, {
        ...fixture.request,
        changes: [{ path, content: 'replacement' }],
      }),
    );
  });
}

test('unchanged content requests a justified no-change assessment', () => {
  const fixture = new ProposalFixture();
  assert.throws(
    () =>
      prepareArchitectureProposal(fixture.capture, {
        ...fixture.request,
        changes: [{ path: 'contracts/service.md', content: original }],
      }),
    /no-change/,
  );
});
