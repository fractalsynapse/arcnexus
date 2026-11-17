import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDirectorResponse, type StandingGoalEvidence } from '../../src/index.js';

const observation: StandingGoalEvidence = {
  owner: 'delivery',
  revision: 'staging-head',
  status: 0,
  log: '/state/current-owner-tests.log',
  recentChanges: [],
};

test('a substantive Director assessment retains the host check instead of model paths', () => {
  const reply = {
    kind: 'satisfied',
    summary: 'The retained owner measure and current source cover the goal.',
    evidence: [observation.log, 'packages/delivery/src/index.ts'],
  };
  const result = { ...reply, evidence: [observation.log] };
  assert.deepEqual(decodeDirectorResponse(reply, observation), result);
  assert.deepEqual(decodeDirectorResponse({ ...reply, evidence: undefined }, observation), result);
  assert.throws(() => decodeDirectorResponse(reply, { ...observation, status: 1 }), /status 1/);
  assert.throws(() => decodeDirectorResponse({ ...reply, summary: ' ' }, observation), /summary/);
});
