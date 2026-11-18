import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDirectorResponse, type StandingGoalEvidence } from '../../src/index.js';

const quote = 'A substantive observed effect.';
const path = 'packages/delivery/src/index.ts';
const observation: StandingGoalEvidence = {
  revision: 'staging-head',
  source: {
    root: '.',
    revision: 'staging-head',
    remote: 'https://example.com/test/test.git',
    paths: [path, '.arc/goals/fixture.md'],
    read: () => quote,
  },
  recentChanges: [],
};

test('a standing goal assessment requires evidence verified against the evaluated revision', () => {
  const reply = {
    kind: 'satisfied',
    summary: 'The captured source demonstrates the goal.',
    evidence: [{ path, quote }],
  };
  assert.deepEqual(decodeDirectorResponse(reply, observation), {
    ...reply,
    evidence: [`staging-head:${path} · ${quote}`],
  });
  assert.throws(
    () => decodeDirectorResponse({ ...reply, evidence: [] }, observation),
    /captured evidence/,
  );
  for (const entry of [
    { path: 'absent.ts', quote },
    { path, quote: 'This excerpt is fabricated.' },
    { path: '.arc/goals/fixture.md', quote },
  ])
    assert.throws(
      () => decodeDirectorResponse({ ...reply, evidence: [entry] }, observation),
      /absent|does not match|authored goal/,
    );
});
