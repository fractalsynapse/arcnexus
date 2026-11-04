import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { RecoveryEvidence } from '../../../../dist/library/report/report.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks host evidence capabilities independently of model descriptions or private filesystem grants. */
class RecoveryEvidenceScenarios {
  /** Paged captures preserve pending edits and uncertain operations after original evidence changes. */
  async pinned(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    writeFileSync(join(f.directory, 'checkpoint.json'), 'CHANGED');
    const manifest = JSON.parse(
      ((await pages.call('assignment.evidence', { artifact: 'manifest' })) as any).content,
    );
    assert.equal(manifest.runId, f.run.id);
    assert.equal(manifest.assignmentId, f.investigator.id);
    const state = (await pages.call('assignment.evidence', {
      artifact: f.source.id + ':state',
    })) as any;
    assert.equal(JSON.parse(state.content).operationInvocations[0].status, 'interrupted');
    const checkpoint = (await pages.call('assignment.evidence', {
      artifact: f.source.id + ':checkpoint',
    })) as any;
    assert.equal(checkpoint.content, '{"safe":false}');
    const journal = (await pages.call('assignment.evidence', {
      artifact: f.source.id + ':edit:edit.json',
    })) as any;
    assert.equal(JSON.parse(journal.content).status, 'pending');
  }

  /** Malformed pages and identity/path substitutions never grant additional artifact access. */
  async invalid(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    const invalid = (await pages.call('assignment.evidence', {
      artifact: 'manifest',
      length: 999999,
    })) as any;
    assert.equal(invalid.status, 'rejected');
    await assert.rejects(
      pages.call('assignment.evidence', { artifact: '../report.json' }),
      /Unknown assignment artifact/,
    );
    await assert.rejects(
      pages.call('assignment.evidence', { artifact: 'manifest', runId: 'foreign' }),
      /arguments/,
    );
  }

  /** Foreign record identities and filesystem aliases cannot expose contents through a matching assignment. */
  async rejected(t: TestContext, mode: string): Promise<void> {
    const f = this.fixture(t);
    const report = join(f.directory, 'report.json');
    if (mode === 'foreign')
      writeFileSync(
        report,
        JSON.stringify({ ...f.record, executionRunId: randomUUID(), error: 'SECRET' }),
      );
    else {
      rmSync(report);
      const outside = join(f.root, 'outside.json');
      writeFileSync(outside, JSON.stringify({ ...f.record, error: 'SECRET' }));
      if (mode === 'hardlink') linkSync(outside, report);
      else symlinkSync(outside, report);
    }
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    const page = (await pages.call('assignment.evidence', { artifact: 'manifest' })) as any;
    assert.equal(JSON.parse(page.content).records[0].evidenceUnavailable, true);
    assert.doesNotMatch(page.content, /SECRET/);
    await assert.rejects(
      pages.call('assignment.evidence', { artifact: f.source.id + ':state' }),
      /Unknown/,
    );
    assert.throws(
      () =>
        new RecoveryEvidence(f.root, f.store).capture({ ...f.investigator, runId: randomUUID() }),
      /identity/,
    );
  }

  /** Registers two same-run assignments and one observed incomplete activation without engineering execution. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-recovery-evidence-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['a', 'b'], 'Investigate retained work');
    const source = store.enqueue(run.id, 'a', 'Original work');
    const investigator = store.enqueue(run.id, 'b', 'Review retained evidence');
    const id = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(join(directory, 'checked-edits'), { recursive: true });
    const record = {
      id,
      executionRunId: run.id,
      assignmentId: source.id,
      commands: [],
      operationInvocations: [{ status: 'interrupted' }],
    };
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
    writeFileSync(join(directory, 'checkpoint.json'), '{"safe":false}');
    writeFileSync(join(directory, 'checked-edits/edit.json'), '{"status":"pending","changes":[]}');
    store.updateAssignment(source.id, 'failed', { recordId: id });
    return { root, store, run, source, investigator, record, directory };
  }
}

const scenarios = new RecoveryEvidenceScenarios();

test('recovery artifacts remain pinned and reject arbitrary capabilities', (t) =>
  scenarios.pinned(t));

test('recovery evidence rejects malformed pages and host path substitution', (t) =>
  scenarios.invalid(t));

for (const mode of ['foreign', 'symlink', 'hardlink'])
  test(`recovery evidence rejects ${mode} records before serving content`, (t) =>
    scenarios.rejected(t, mode));

registerSuite({ component: 'report', level: 'acceptance', tags: ['deterministic', 'recovery'] });
