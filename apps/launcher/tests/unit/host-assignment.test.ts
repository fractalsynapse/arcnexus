import assert from 'node:assert/strict';
import test from 'node:test';
import { hostAssignmentSchema } from '../../src/index.js';

export const suite = { owner: 'launcher-app', level: 'unit', tags: ['host'] } as const;

const assignment = {
  project: 'e1b458bb-5563-4c32-9977-27d9b3ebcc41',
  remote: 'https://github.com/example/project.git',
  revision: 'a'.repeat(40),
  checkout: '/fixture/checkout',
  storage: '/fixture/state',
  credentials: '/fixture/credential',
  database: '/fixture/database',
  network: 'arcnexus_data',
  image: {
    source: 'registry',
    ref: 'registry.test/arc/host@sha256:' + 'c'.repeat(64),
    approvedImage: 'sha256:' + 'a'.repeat(64),
    base: 'sha256:' + 'b'.repeat(64),
  },
};

test('a Host assignment requires approved image identities and local absolute paths', () => {
  assert.equal(hostAssignmentSchema.safeParse(assignment).success, true);
  assert.equal(
    hostAssignmentSchema.safeParse({ ...assignment, checkout: './target' }).success,
    false,
  );
  assert.equal(hostAssignmentSchema.safeParse({ ...assignment, network: 'host' }).success, false);
  const image = { ...assignment.image, ref: 'registry.test/arc/host:latest' };
  assert.equal(hostAssignmentSchema.safeParse({ ...assignment, image }).success, false);
});
