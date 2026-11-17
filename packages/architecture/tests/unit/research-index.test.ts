import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../src/index.js';
import { researchIndex } from '../../src/research.js';

test('the research index derives summaries from the selected owner reports', () => {
  const path = `.arc/research/team/${'a'.repeat(64)}.md`;
  const other = path.replace('/team/', '/reviewer/');
  const report =
    '---\nquestion: Is order stable?\nsummary: The provider guarantees stable order.\nconsulted: 2026-11-17\n---\n';
  const capture = {
    project: { knowledgeRoot: '.arc' },
    source: {
      paths: [other, path],
      read: (requested: string) => {
        assert.equal(requested, path);
        return report;
      },
    },
  } as unknown as Capture;
  assert.deepEqual(researchIndex(capture, 'team'), {
    directory: '.arc/research/team',
    total: 1,
    recent: [
      {
        path,
        question: 'Is order stable?',
        summary: 'The provider guarantees stable order.',
        consulted: '2026-11-17',
      },
    ],
  });
});
