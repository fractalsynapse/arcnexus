import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { fixture } from '../support/workspace-fixture.js';

/** Exercises cleanup against clean real worktrees retained by general execution records. */
class ExecutionRetentionScenarios {
  /** Keeps policy/candidate and assignment workspaces despite superficially disposable local status. */
  retained(t: TestContext, assignment: boolean): void {
    const f = fixture(t);
    const prepared = f.prepare();
    assert.equal(prepared.status, 0, prepared.stderr);
    const record = JSON.parse(prepared.stdout);
    const store = new ExecutionStore(join(f.state, 'projects', 'fixture', 'execution.sqlite'));
    try {
      const run = store.createRun('task', ['sample'], 'Retain unfinished research');
      if (assignment)
        record.assignmentId = store.enqueue(run.id, 'sample', 'Research', ['Evidence']).id;
      else record.executionRunId = run.id;
      store.updateRun(run.id, 'paused', { workspace: record });
    } finally {
      store.close();
    }
    const directory = join(f.state, 'runs', record.id);
    const report = join(directory, 'report.json');
    writeFileSync(report, JSON.stringify(record));
    const before = readFileSync(report);
    const result = f.run('cleanup', record.id);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /retained.*execution/i);
    assert.ok(existsSync(record.workspace));
    assert.equal(existsSync(join(directory, 'cleanup-intent.json')), false);
    assert.deepEqual(readFileSync(report), before);
    assert.equal(f.git('rev-parse', record.branch), record.base);
  }
}

const scenarios = new ExecutionRetentionScenarios();

test('cleanup preserves a clean general-run policy workspace', (t) => scenarios.retained(t, false));

test('cleanup preserves a clean retained assignment workspace', (t) => scenarios.retained(t, true));

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'retention'],
});
