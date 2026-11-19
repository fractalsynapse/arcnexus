import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination, type Journal } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['evidence'] } as const;

/** Retain a complete research and repair history in the actual project journal. */
class CompleteHistory {
  readonly journal: Journal;
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-complete-history-'));

  /** Open one disposable writer and preserve normal close-before-cleanup ordering. */
  constructor(t: TestContext) {
    const journal = new Coordination(this.root).admit('https://example.com/project.git', 'History');
    assert('record' in journal);
    this.journal = journal;
    t.after(() => {
      this.journal.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Append actual-shaped observations without inventing another history index or store. */
  record(count: number) {
    for (let index = 0; index < count; index++)
      this.journal.record({
        researchResult: {
          component: 'owner',
          archive: `report-${index}.md`,
          request: { id: String(index) },
        },
        stewardRepair: {
          scope: { owner: 'owner', activity: 'implementation' },
          diagnostic: `Finding ${index}`,
        },
      });
  }
}

test('research and repair queries retain every observation without result-count cutoffs', (t) => {
  const scenario = new CompleteHistory(t);
  scenario.record(35);
  assert.deepEqual(
    [scenario.journal.researchReports('owner').length, scenario.journal.findings().length],
    [35, 35],
  );
});
