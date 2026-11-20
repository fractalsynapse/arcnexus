import assert from 'node:assert/strict';
import test from 'node:test';
import { team } from '../../src/index.js';

export const suite = { owner: 'team', level: 'unit', tags: ['regression'] } as const;

const members = {
  c: { id: 'c', owns: ['docs'], activities: { review: { profile: 'review' } } },
  b: { id: 'b', owns: ['src/b'], activities: { testing: { profile: 'test' } } },
  a: { id: 'a', owns: ['src'], activities: { testing: { profile: 'test' } } },
};

const rosterCases: {
  name: string;
  query: Parameters<typeof team.list>[1];
  ids: string[];
}[] = [
  { name: 'stable IDs from unsorted input', query: {}, ids: ['a', 'b', 'c'] },
  {
    name: 'priority precedence and stable ties',
    query: { priority: { c: -2, a: -1, b: -1 } },
    ids: ['c', 'a', 'b'],
  },
  { name: 'component', query: { component: 'b' }, ids: ['b'] },
  { name: 'activity', query: { activity: 'testing' }, ids: ['a', 'b'] },
  { name: 'eligibility', query: { eligible: new Set(['b', 'a']) }, ids: ['a', 'b'] },
  {
    name: 'combined filters and priority',
    query: { activity: 'testing', eligible: new Set(['c', 'b']), priority: { b: -1 } },
    ids: ['b'],
  },
  {
    name: 'component excluded by eligibility',
    query: { component: 'a', eligible: new Set(['b']) },
    ids: [],
  },
  { name: 'absent component', query: { component: 'missing' }, ids: [] },
  { name: 'absent activity', query: { activity: 'missing' }, ids: [] },
  { name: 'empty eligibility', query: { eligible: new Set() }, ids: [] },
];

for (const { name, query, ids } of rosterCases) {
  test(`TM-1/TM-2: deterministic roster with ${name}`, () => {
    for (let call = 0; call < 3; call++) {
      assert.deepEqual(
        team.list(members, query).map(({ id }) => id),
        ids,
      );
    }
    assert.deepEqual(Object.keys(members), ['c', 'b', 'a']);
  });
}

const captured = Object.values(members);
const eligibilityCases = [
  { name: 'all owners', eligible: undefined },
  { name: 'only a', eligible: new Set(['a']) },
  { name: 'only b', eligible: new Set(['b']) },
  { name: 'only c', eligible: new Set(['c']) },
  { name: 'no owners', eligible: new Set<string>() },
];

for (const { name, eligible } of eligibilityCases) {
  test(`TM-3/TM-4: unique ownership remains complete with ${name} eligible`, () => {
    for (let call = 0; call < 3; call++) {
      team.list(members, { eligible });
      assert.deepEqual(team.ownerFor(captured, 'src/file', eligible), {
        kind: !eligible || eligible.has('a') ? 'owned' : 'unavailable',
        path: 'src/file',
        owner: members.a,
      });
      assert.deepEqual(team.ownerFor(captured, 'docs/file', eligible), {
        kind: !eligible || eligible.has('c') ? 'owned' : 'unavailable',
        path: 'docs/file',
        owner: members.c,
      });
    }
  });

  test(`TM-4: collision retains both owners with ${name} eligible`, () => {
    for (let call = 0; call < 3; call++) {
      const eligibleIDs = new Set(team.list(members, { eligible }).map(({ id }) => id));
      assert.deepEqual(team.ownerFor(captured, 'src/b/file', eligibleIDs), {
        kind: 'collision',
        path: 'src/b/file',
        owners: [members.b, members.a],
      });
    }
  });

  test(`TM-4: uncovered path remains explicit with ${name} eligible`, () => {
    for (let call = 0; call < 3; call++) {
      const eligibleIDs = new Set(team.list(members, { eligible }).map(({ id }) => id));
      assert.deepEqual(team.ownerFor(captured, 'elsewhere', eligibleIDs), {
        kind: 'unowned',
        path: 'elsewhere',
      });
    }
  });

  test(`TM-6: coverage remains complete after filtering to ${name}`, () => {
    for (let call = 0; call < 3; call++) {
      team.list(members, { eligible });
      assert.deepEqual(team.validateCoverage(captured, ['src/file', 'src/b/file', 'elsewhere']), [
        { kind: 'collision', path: 'src/b/file', owners: [members.b, members.a] },
        { kind: 'unowned', path: 'elsewhere' },
      ]);
    }
  });
}

test('TM-4: ownership respects directory boundaries', () => {
  assert.deepEqual(team.ownerFor(captured, 'src-next/file'), {
    kind: 'unowned',
    path: 'src-next/file',
  });
  assert.deepEqual(team.ownerFor(captured, 'src'), {
    kind: 'owned',
    path: 'src',
    owner: members.a,
  });
});
