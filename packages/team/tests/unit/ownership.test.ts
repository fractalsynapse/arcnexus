import assert from 'node:assert/strict';
import test from 'node:test';
import { team } from '../../src/index.js';

const members = {
  a: { id: 'a', owns: ['src'], activities: { testing: { profile: 'test' } } },
  b: { id: 'b', owns: ['src/b'], activities: { testing: { profile: 'test' } } },
  c: { id: 'c', owns: ['docs'], activities: { review: { profile: 'review' } } },
};

test('Team filters and orders eligible stewards while preserving ownership collisions', () => {
  assert.deepEqual(
    team.list(members, { activity: 'testing', priority: { b: -1 } }).map(({ id }) => id),
    ['b', 'a'],
  );
  assert.deepEqual(
    team.list(members, { activity: 'testing' }).map(({ id }) => id),
    ['a', 'b'],
  );
  assert.equal(
    team.ownerFor(Object.values(members), 'src/b/file', new Set(['a'])).kind,
    'collision',
  );
  assert.equal(
    team.ownerFor(Object.values(members), 'docs/file', new Set(['a'])).kind,
    'unavailable',
  );
  assert.equal(team.ownerFor(Object.values(members), 'docs/file').kind, 'owned');
  assert.deepEqual(
    team
      .validateCoverage(Object.values(members), ['src/a', 'src/b/c', 'elsewhere'])
      .map(({ kind }) => kind),
    ['collision', 'unowned'],
  );
});
