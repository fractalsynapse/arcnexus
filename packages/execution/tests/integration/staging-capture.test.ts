import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { stagingCapture } from '../../src/goals.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

test('a round observes the unchanged staging head without fetching the existing object', () => {
  const revision = 'a'.repeat(40);
  const capture = {
    source: { root: '/fixture', revision },
    project: { delivery: { baseBranch: 'staging', protectedBranch: 'main' } },
  } as Capture;
  const reads: string[][] = [];
  const selected = stagingCapture(new Architecture(), capture, (root, ...args) => {
    assert.equal(root, '/fixture');
    reads.push(args);
    return `${revision}\trefs/heads/staging`;
  });
  assert.equal(selected, capture);
  assert.deepEqual(reads, [['ls-remote', '--exit-code', 'origin', 'refs/heads/staging']]);
});
