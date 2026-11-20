import assert from 'node:assert/strict';
import test from 'node:test';
import { unifiedDiff } from '../../src/index.js';

export const suite = { owner: 'foundation', level: 'unit', tags: ['evidence'] } as const;

test('reviewable diffs retain complete proposed files beyond the process default output buffer', () => {
  const content = 'Complete proposed requirement. '.repeat(100_000);
  const patch = unifiedDiff({ path: 'requirements.md', before: '', content });
  assert(patch.includes(`+${content}`));
});
