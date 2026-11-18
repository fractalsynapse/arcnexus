import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import type { TaskSession } from '../../../workflow/src/index.js';
import { goalInventory } from '../../src/inventory.js';
import { decodeProposal } from '../../src/proposal.js';
import { objectivePath, objectiveRecord, showPatch } from '../../src/records.js';

export const suite = { owner: 'planner', level: 'unit', tags: ['planning'] } as const;
const id = 'reviewed-tree';
const objective = '  Preserve exact approval.\n```\n';
const source = { path: 'docs/charter.md', quote: 'The architect establishes approved boundaries.' };
const goal =
  '---\npriority: 20\n---\n# Keep reviewed deliveries\n\n**Success measures.** Preserve the accepted tree.\n';

/** Provide a committed owner-free goal, project text and a Planner reply referencing both. */
class ProposalScenario {
  private readonly file = new Map([
    [source.path, source.quote],
    [`.arc/goals/${id}.md`, goal],
  ]);
  readonly capture = {
    project: { knowledgeRoot: '.arc' },
    source: {
      revision: 'fixture',
      remote: 'https://example.com/fixture/fixture.git',
      paths: [...this.file.keys()],
      read: (path: string) => this.file.get(path)!,
    },
  } as unknown as Capture;
  readonly session = { goal: objective, capture: this.capture } as TaskSession;

  readonly reply = {
    summary: 'The reviewed tree goal covers the approved boundary.',
    ratings: [
      {
        id,
        alignment: 'strong',
        evidence: 'unverified',
        reason: 'No current run observed.',
        sources: [source],
        observations: [],
      },
    ],
    comparison: ['The charter adds no second approval gate.'],
    changes: [],
    links: [id],
    sources: [source],
  };
}

test('Planner validates owner-free inventory coverage and exact source citations', () => {
  const scenario = new ProposalScenario();
  assert.deepEqual(
    goalInventory(scenario.capture).map(({ id }) => id),
    [id],
  );
  assert.equal(decodeProposal(scenario.reply, scenario.capture, [id], false).ratings.length, 1);
  assert.throws(
    () => decodeProposal({ ...scenario.reply, ratings: [] }, scenario.capture, [id], false),
    /rate each captured goal/,
  );
  assert.throws(
    () =>
      decodeProposal(
        {
          ...scenario.reply,
          sources: [{ ...source, quote: 'A fabricated quotation.' }],
        },
        scenario.capture,
        [id],
        true,
      ),
    /does not match/,
  );
});

test('Planner rejects owner metadata and goal files without named measures', () => {
  const { capture, reply } = new ProposalScenario();
  for (const content of [
    goal.replace('priority: 20', 'priority: 20\nowner: delivery'),
    goal.replace('**Success measures.**', '**Example.**'),
  ]) {
    assert.throws(
      () => decodeProposal({ ...reply, changes: [{ id, content }] }, capture, [id], true),
      /without an owner|Success measures/,
    );
  }
});

test('objective records preserve exact intake and replies separately from the mapping', () => {
  const { capture, reply, session } = new ProposalScenario();
  const proposal = decodeProposal(reply, capture, [id], true);
  const input = [{ question: 'Which boundary?', answer: '  Keep the reviewer gate.\n' }];
  const record = objectiveRecord(session, proposal, input, new Set([id]));
  assert.match(objectivePath(session), /^\.arc\/objectives\/[a-f0-9]{64}\.md$/);
  assert(record.includes(`\n${objective}\n`));
  assert(record.includes(`\n${input[0]!.answer}\n`));
  assert.match(record, /status: active/);
  assert(record.includes(source.quote));
  assert.notEqual(
    showPatch([{ path: `.arc/goals/${id}.md`, before: goal, content: goal }]),
    showPatch([{ path: `.arc/goals/${id}.md`, before: goal, content: goal + '\n' }]),
  );
});

test('unresolved objectives can be recorded before any goal link exists', () => {
  const { capture, reply } = new ProposalScenario();
  const pending = {
    ...reply,
    links: [],
    changes: [],
    summary: 'The priority conflict is unresolved.',
  };
  assert.deepEqual(decodeProposal(pending, capture, [id], true).links, []);
});

test('source coverage alone cannot give a demonstrated runtime rating', () => {
  const { capture, reply } = new ProposalScenario();
  const ratings = [{ ...reply.ratings[0], evidence: 'demonstrated', observations: [source] }];
  assert.throws(() => decodeProposal({ ...reply, ratings }, capture, [id], false), /verified run/);
});

test('verified ratings name an observed operation at the evaluated revision', () => {
  const { capture, reply } = new ProposalScenario();
  const run = {
    id: 'run:8',
    revision: capture.source.revision,
    tree: 'current-tree',
    goalID: 'current-goal',
    checks: [{ operation: 'repository-tests', status: 0 as const }],
    criteria: ['tree-matches'],
  };
  const proposed = {
    ...reply,
    ratings: [
      {
        ...reply.ratings[0],
        evidence: 'demonstrated',
        run: { run: run.id, operation: 'repository-tests' },
      },
    ],
  };
  assert.equal(decodeProposal(proposed, capture, [id], false, run).ratings[0]?.run, run);
  assert.throws(
    () => decodeProposal(proposed, capture, [id], false, { ...run, revision: 'stale' }),
    /stale verified run/,
  );
  assert.throws(
    () => decodeProposal(proposed, capture, [id], false, { ...run, checks: [] }),
    /stale verified run/,
  );
});
