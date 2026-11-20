import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import type { VerifiedGoalRun } from '../../../execution/src/index.js';
import type { TaskSession } from '../../../workflow/src/index.js';
import { goalInventory } from '../../src/inventory.js';
import { decodeProposal } from '../../src/proposal.js';
import { objectivePath, objectiveRecord, reportProposal, showPatch } from '../../src/records.js';

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

test('Planner retains complete detailed proposals and all proposed goals and citations', () => {
  const { capture, reply } = new ProposalScenario();
  const quote = 'Detailed source evidence. '.repeat(100);
  const complete = {
    ...capture,
    source: { ...capture.source, read: () => `${source.quote}\n${quote}` },
  };
  const proposed = {
    ...reply,
    summary: 'Detailed mapping. '.repeat(1000),
    changes: Array.from({ length: 25 }, (_, index) => ({
      id: `goal-${index}`,
      content: `${goal}\n${'Detailed requirements. '.repeat(1000)}`,
    })),
    sources: Array.from({ length: 25 }, () => ({ ...source, quote })),
    comparison: Array.from({ length: 600 }, () => 'Evaluate this relationship.'),
  };
  const result = decodeProposal(proposed, complete, [id], true);
  assert.equal(result.summary, proposed.summary);
  assert.deepEqual(result.changes, proposed.changes);
  assert.deepEqual(result.sources, proposed.sources);
  assert.deepEqual(result.comparison, proposed.comparison);
});

test('source coverage alone cannot give a demonstrated runtime rating', () => {
  const { capture, reply } = new ProposalScenario();
  const ratings = [{ ...reply.ratings[0], evidence: 'demonstrated', observations: [source] }];
  assert.throws(() => decodeProposal({ ...reply, ratings }, capture, [id], false), /verified run/);
});

type Selection = { operation: string } | { criterion: string } | { delivery: true };

const verifiedRun: VerifiedGoalRun = {
  id: 'run:8',
  revision: 'fixture',
  tree: 'current-tree',
  goalID: 'current-goal',
  pull: 'https://github.com/example/fixture/pull/8',
  checks: [
    { operation: 'owner-format', status: 0 },
    { operation: 'repository-tests', status: 0 },
  ],
  criteria: ['approval-preserved', 'tree-matches'],
};

const selections: { selection: Selection; category: RegExp; observed: string }[] = [
  { selection: { operation: 'repository-tests' }, category: /check/i, observed: 'repository-tests' },
  { selection: { criterion: 'tree-matches' }, category: /independent review/i, observed: 'tree-matches' },
  { selection: { delivery: true }, category: /delivery/i, observed: verifiedRun.pull! },
];

/** Decode the same neutral assessment with only its selected host observation changed. */
function observedProposal(selection: Selection, run: VerifiedGoalRun = verifiedRun) {
  const { capture, reply } = new ProposalScenario();
  const proposed = {
    ...reply,
    ratings: [
      { ...reply.ratings[0], evidence: 'demonstrated', run: { run: verifiedRun.id, ...selection } },
    ],
  };
  return decodeProposal(proposed, capture, [id], false, run);
}

// Planner.propose passes decoded proposals to reportProposal. Distinct selections must
// remain distinct without prescribing the representation used to retain that selection.
test('mapping validation retains distinct check, review and delivery selections', () => {
  const proposals = selections.map(({ selection }) => observedProposal(selection));
  for (const [index, proposal] of proposals.entries()) {
    assert.notDeepEqual(proposal, proposals[(index + 1) % proposals.length]);
    assert.deepEqual(proposal.changes, []);
  }
});

test('mapping validation retains the exact operation instead of choosing the first check', () => {
  assert.notDeepEqual(
    observedProposal({ operation: 'repository-tests' }),
    observedProposal({ operation: 'owner-format' }),
  );
});

test('mapping validation retains the exact criterion instead of choosing the first review finding', () => {
  assert.notDeepEqual(
    observedProposal({ criterion: 'tree-matches' }),
    observedProposal({ criterion: 'approval-preserved' }),
  );
});

// Each decoded proposal reaches the real renderer separately so one missing category
// cannot hide the failures for the other forms. Neutral prose cannot echo the selection.
for (const { selection, category, observed } of selections) {
  test(`mapping report traces selected ${Object.keys(selection)[0]} to its verified run`, () => {
    const { capture } = new ProposalScenario();
    const proposal = observedProposal(selection);
    const report = reportProposal(proposal, capture.source, []);
    assert(report.includes(verifiedRun.id), 'the verified run identity survives');
    assert(report.includes(`\`${verifiedRun.revision}\``), 'the evaluated revision survives');
    assert(report.includes('- Source ·'), 'accepted direction stays labelled as source');
    assert(report.includes(source.quote), 'the captured source quote survives');
    assert.match(report, category, 'the selected evidence category is explicit');
    assert(report.includes(observed), 'the exact selected observation is explicit');
    assert(!report.includes('owner-format'), 'an unselected check is not substituted');
    assert(!report.includes('approval-preserved'), 'an unselected criterion is not substituted');
    if (!('operation' in selection)) assert(!report.includes('repository-tests'));
    if (!('criterion' in selection)) assert(!report.includes('tree-matches'));
    assert.deepEqual(proposal.changes, [], 'observations do not create standing goal edits');
    assert.equal(capture.source.read(`.arc/goals/${id}.md`), goal);
  });
}

test('verified mapping rejects unknown run identities for every citation form', () => {
  const { capture, reply } = new ProposalScenario();
  for (const { selection } of selections) {
    const ratings = [
      { ...reply.ratings[0], evidence: 'demonstrated', run: { run: 'run:unknown', ...selection } },
    ];
    assert.throws(
      () => decodeProposal({ ...reply, ratings }, capture, [id], false, verifiedRun),
      /Unknown or stale verified run citation/,
    );
  }
});

test('verified mapping rejects stale revisions for every citation form', () => {
  for (const { selection } of selections) {
    assert.throws(
      () => observedProposal(selection, { ...verifiedRun, revision: 'stale' }),
      /Unknown or stale verified run citation/,
    );
  }
});

test('verified mapping rejects operations and criteria absent from a populated run', () => {
  for (const selection of [
    { operation: 'unknown-operation' },
    { criterion: 'unknown-criterion' },
  ]) {
    assert.throws(
      () => observedProposal(selection),
      /Unknown or stale verified run citation/,
    );
  }
});

test('verified mapping rejects delivery without supporting publication', () => {
  const { pull: _pull, ...reviewedOnly } = verifiedRun;
  assert.throws(
    () => observedProposal({ delivery: true }, reviewedOnly),
    /Unknown or stale verified run citation/,
  );
});

test('an available verified run does not promote source coverage into demonstrated results', () => {
  const { capture, reply } = new ProposalScenario();
  const ratings = [{ ...reply.ratings[0], evidence: 'demonstrated', observations: [source] }];
  assert.throws(
    () => decodeProposal({ ...reply, ratings }, capture, [id], false, verifiedRun),
    /Demonstrated evidence requires an applicable verified run/,
  );
});
