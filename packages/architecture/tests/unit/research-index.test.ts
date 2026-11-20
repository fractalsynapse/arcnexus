import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../src/index.js';
import { researchIndex } from '../../src/research.js';

export const suite = { owner: 'architecture', level: 'unit', tags: ['regression'] } as const;

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

test('research indexing retains every report and complete authored metadata', () => {
  const question = 'Complete research direction. '.repeat(100);
  const summary = 'Complete report summary. '.repeat(100);
  const paths = Array.from(
    { length: 20 },
    (_, id) => `.arc/research/team/${id.toString(16).padStart(64, '0')}.md`,
  );
  const capture = {
    project: { knowledgeRoot: '.arc' },
    source: {
      paths,
      read: () =>
        `---\nquestion: ${JSON.stringify(question)}\nsummary: ${JSON.stringify(summary)}\nconsulted: 2026-11-19\n---\n`,
    },
  } as unknown as Capture;
  const index = researchIndex(capture, 'team');
  assert.equal(index.total, paths.length);
  assert.equal(index.recent.length, paths.length);
  for (const report of index.recent) {
    assert.equal(report.question, question);
    assert.equal(report.summary, summary);
  }
});
