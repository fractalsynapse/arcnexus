import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ConflictCorrection } from '../../../../dist/library/execution-runtime/conflict-correction.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { CheckedEdits } from '../../../../dist/library/workspace/checked-edits.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Exercises real Git conflict source with component authority and checked resolution. */
class ConflictScenarios {
  /** Captures two competing owned changes without changing the source branch or index. */
  private fixture(t: TestContext, binary = false) {
    const f = generalCatalogFixture(t);
    const context = new ExecutionContext().resolve(f.repo);
    const snapshots = new CandidateSnapshots(f.repo, join(f.state, 'snapshots'));
    writeFileSync(join(f.repo, 'source.txt'), 'staging behavior\n' + (binary ? '\0left' : ''));
    const current = snapshots.capture(f.repo, context.base);
    writeFileSync(join(f.repo, 'source.txt'), 'assignment behavior\n' + (binary ? '\0right' : ''));
    const incoming = snapshots.capture(f.repo, context.base);
    const result = snapshots.reconcile(context.base, current, incoming);
    if (result.status !== 'conflict') throw new Error('Expected a real text conflict');
    const record = {
      workspace: f.repo,
      resolvedAssignment: { assignment: { kind: 'change' } },
    } as unknown as RecordData;
    return { f, context, result, record };
  }

  /** Both inputs remain visible; only checked owner edits clear the unfinished merge fences. */
  owned(t: TestContext): void {
    const { f, context, result, record } = this.fixture(t);
    ConflictCorrection.capture(context, 'a', record, result);
    const content = f.git('show', result.revision + ':source.txt');
    assert.match(content, /staging behavior/);
    assert.match(content, /assignment behavior/);
    writeFileSync(join(f.repo, 'source.txt'), content);
    assert.throws(() => ConflictCorrection.assertResolved(record), /Resolve retained conflict/);
    assert.match(ConflictCorrection.feedback(record), /checked edits/);
    const edits = new CheckedEdits(f.repo, join(f.state, 'edits'), 'authority', (path) => {
      assert.equal(path, 'source.txt');
    });
    edits.apply({
      id: 'resolve-conflict',
      changes: [
        {
          path: 'source.txt',
          operation: 'update',
          expectedSha256: digest(readFileSync(join(f.repo, 'source.txt'))),
          content: 'staging behavior\nassignment behavior\n',
        },
      ],
    });
    ConflictCorrection.assertResolved(record);
    assert.equal(f.git('rev-parse', 'HEAD'), context.base);
  }

  /** Binary conflicts retain their evidence instead of inventing an editable text resolution. */
  binary(t: TestContext): void {
    const { context, result, record } = this.fixture(t, true);
    assert.throws(
      () => ConflictCorrection.capture(context, 'a', record, result),
      /explicit decision/,
    );
    assert.equal(record.reconciliationConflict, undefined);
  }

  /** An unrelated owner cannot receive conflict edits or claim permission from the merge result. */
  authority(t: TestContext): void {
    const { context, result, record } = this.fixture(t);
    assert.throws(() => ConflictCorrection.capture(context, 'b', record, result), /another owner/);
    assert.equal(record.reconciliationConflict, undefined);
    (record.resolvedAssignment as any).assignment.kind = 'research';
    assert.throws(
      () => ConflictCorrection.capture(context, 'a', record, result),
      /Candidate conflict/,
    );
  }
}

const scenarios = new ConflictScenarios();

test('owned text conflicts remain unfinished until checked resolution', (t) => scenarios.owned(t));

test('conflict continuation preserves owner and read-only activity authority', (t) =>
  scenarios.authority(t));

test('binary conflicts retain an explicit blocked outcome', (t) => scenarios.binary(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
