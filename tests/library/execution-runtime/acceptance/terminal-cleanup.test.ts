import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { save } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Uses the real host tick and workspace cleanup against settled controlled filesystem state. */
class TerminalCleanupScenarios {
  /** Captures a real package/worktree while keeping model execution outside a terminal cleanup test. */
  private setup(t: TestContext, mode: 'task' | 'workday') {
    const f = generalCatalogFixture(t);
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.close());
    const run = host.store.createRun(mode, ['a'], 'Finish cleanup');
    const record = createWorkspace(f.state, { project: f.repo, bindings: context.bindings });
    f.git('worktree', 'add', '-b', record.branch, record.workspace, record.base);
    mkdirSync(join(record.workspace, 'generated'));
    writeFileSync(join(record.workspace, 'generated', 'dependency'), 'installed');
    record.executionRunId = run.id;
    record.status = 'completed';
    record.environment.generatedDirectories = ['generated'];
    record.operationInvocations = [];
    record.preparedDependencies = [
      { key: 'fixture', outputs: ['generated'], result: { exitCode: 0 } },
    ];
    save(f.state, record);
    host.store.updateRun(run.id, 'paused', { workspace: record });
    return { f, context, host, run, record };
  }

  /** Finalizes tasks/workdays through the same cleanup route and avoids repeated durable work. */
  async terminal(t: TestContext, mode: 'task' | 'workday', cancelled = false): Promise<void> {
    const { f, host, run, record } = this.setup(t, mode);
    const report = join(f.state, 'runs', record.id, 'report.json');
    const before = readFileSync(report);
    if (cancelled) host.cancel(run.id, true);
    else host.store.updateRun(run.id, mode === 'task' ? 'completed' : 'stopped');
    await host.tick();
    assert.equal(existsSync(join(record.workspace, 'generated')), false);
    assert.deepEqual(readFileSync(report), before);
    assert.ok(host.store.run(run.id).data.dependencyCleanup);
    const sequence = host.store.eventSequence();
    await host.tick();
    assert.equal(host.store.eventSequence(), sequence);
    assert.ok(existsSync(join(record.workspace, 'source.txt')));
  }

  /** A paused run retains dependencies and its durable state without housekeeping mutations. */
  async paused(t: TestContext): Promise<void> {
    const { host, run, record } = this.setup(t, 'task');
    const sequence = host.store.eventSequence();
    await host.tick();
    assert.ok(existsSync(join(record.workspace, 'generated', 'dependency')));
    assert.equal(host.store.run(run.id).data.dependencyCleanup, undefined);
    assert.equal(host.store.eventSequence(), sequence);
  }
}

const scenarios = new TerminalCleanupScenarios();

test('terminal task cleanup uses the canonical workspace cleanup path', (t) =>
  scenarios.terminal(t, 'task'));

test('stopped workday cleanup uses the canonical workspace cleanup path', (t) =>
  scenarios.terminal(t, 'workday'));

test('cancelled task cleanup waits for terminal host dispatch', (t) =>
  scenarios.terminal(t, 'task', true));

test('automatic cleanup leaves paused runs unchanged', (t) => scenarios.paused(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'retention'],
});
