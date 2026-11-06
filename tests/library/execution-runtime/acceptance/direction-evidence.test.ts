import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Checks that blocked direction receives runtime-owned facts instead of asking users to retrieve them. */
class DirectionEvidenceScenarios {
  /** Delivers exact current-run checkpoint facts while distinguishing safe and uncertain continuation. */
  async inspect(t: TestContext, safe: boolean, large = false): Promise<void> {
    const { f, host, run, assignment, record } = await this.fixture(t, safe);
    if (large)
      host.store.updateAssignment(assignment.id, 'failed', {
        diagnostic: 'LARGE:' + 'x'.repeat(1100000),
      });
    await host.tick();
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const prompt = calls.find((call) => call.prompt.includes('Blocked task diagnosis')).prompt;
    assert.ok(prompt.length < 100000, 'Initial prompt must not inline retained histories');
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    const payload = JSON.parse(trace.artifacts.state);
    assert.equal(payload.currentRunId, run.id);
    const selected = payload.state.find((item: any) => item.id === assignment.id);
    const captured = JSON.parse(trace.artifacts[selected.artifact]);
    if (large)
      assert.equal(JSON.parse(trace.artifacts[captured.data.artifact]).diagnostic.length, 1100006);
    const evidence = captured.checkpointEvidence;
    assert.deepEqual(
      JSON.parse(trace.artifacts.catalog)
        .components.map((item: any) => item.id)
        .sort(),
      ['a', 'b', 'c'],
    );
    this.checkpoint(evidence, record, safe, captured, trace.artifacts);
    assert.equal(host.store.assignment(assignment.id).status, safe ? 'ready' : 'failed');
  }

  /** Fair stewardship pages existing owner history before recording an unchanged consideration. */
  async stewardship(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    host.control('start');
    const run = host.store.runs().find((item) => item.mode === 'workday')!;
    host.store.updateRun(run.id, 'running', { initialized: true });
    const assignment = host.store.enqueue(run.id, 'a', 'Existing investigation');
    host.store.fail(assignment.id, 'blocked', 'Observed unavailable input');
    host.store.updateAssignment(assignment.id, 'blocked', { diagnostic: 'x'.repeat(1100000) });
    await host.tick();
    const trace = this.trace(f.calls);
    const selected = JSON.parse(trace.artifacts.state).state.find(
      (item: any) => item.id === assignment.id,
    );
    const captured = JSON.parse(trace.artifacts[selected.artifact]);
    assert.equal(JSON.parse(trace.artifacts[captured.data.artifact]).diagnostic.length, 1100000);
    assert.ok(host.store.run(run.id).data.seen);
    assert.equal(host.store.assignment(assignment.id).status, 'blocked');
  }

  /** Task clarification stays available in full without becoming part of its original goal or prompt. */
  async clarification(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('READ_DIRECTION_EVIDENCE: inspect retained clarification');
    host.store.updateRun(run.id, 'running', { redirection: 'x'.repeat(1100000) });
    await host.tick();
    const trace = this.trace(f.calls);
    assert.equal(JSON.parse(trace.artifacts.feedback).feedback.length, 1100000);
    assert.equal(host.store.run(run.id).objective, run.objective);
    assert.equal(host.store.assignments(run.id)[0]!.owner, 'a');
  }

  /** Checks the actual managed invocation and returns the complete MCP-observed pinned artifacts. */
  private trace(calls: string): any {
    const observations = readFileSync(calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const prompt = observations.find((item) =>
      item.prompt.startsWith('ArcNexus task direction.'),
    ).prompt;
    assert.ok(prompt.length < 100000, 'Direction must page retained context');
    return JSON.parse(readFileSync(calls + '.evidence', 'utf8').trim());
  }

  /** Preserves complete observed checkpoint facts through paging for both safe and unsafe continuation. */
  private checkpoint(
    evidence: any,
    record: any,
    safe: boolean,
    captured: any,
    artifacts: any,
  ): void {
    const facts = JSON.parse(artifacts[captured.record.artifact]);
    assert.equal(evidence.recordId, record.id);
    assert.equal(facts.threadId, record.threadId);
    assert.equal(facts.nextStage, 'research');
    assert.deepEqual(JSON.parse(artifacts[facts.plan.artifact]), record.plan);
    assert.equal(evidence.continuation.eligible, safe);
    assert.equal(facts.workspace, record.workspace);
    assert.equal(facts.base, record.base);
    assert.deepEqual(facts.checkpoint, record.checkpoint);
    const commands = JSON.parse(artifacts[facts.commands.artifact]);
    assert.ok(commands.some((command: any) => command.exitCode === 0));
  }

  /** Retains a real planned assignment and introduces a known failure after its checkpoint. */
  private async fixture(t: TestContext, safe: boolean) {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    const run = host.submit('RECOVER_BLOCKED: diagnose the retained supplier');
    host.store.updateRun(run.id, 'running', { initialized: true });
    const assignment = host.store.enqueue(run.id, 'c', 'Research evidence', [
      'Evidence-backed result',
    ]);
    host.store.updateAssignment(assignment.id, 'ready', { proposal: { kind: 'research' } });
    await host.tick();
    const path = join(
      f.state,
      'runs',
      String(host.store.assignment(assignment.id).data.recordId),
      'report.json',
    );
    const record = JSON.parse(readFileSync(path, 'utf8'));
    record.safeCheckpoint = safe;
    writeFileSync(path, JSON.stringify(record));
    host.store.fail(assignment.id, 'failed', 'Retained diagnostic requiring direction');
    return { f, host, run, assignment, record };
  }
}

const scenarios = new DirectionEvidenceScenarios();

for (const safe of [true, false])
  test(
    'blocked director receives ' +
      (safe ? 'safe' : 'uncertain') +
      ' checkpoint evidence automatically',
    (t) => scenarios.inspect(t, safe),
  );

test('blocked director retrieves more than one megabyte of retained evidence without prompt overflow', (t) =>
  scenarios.inspect(t, true, true));

test('workday stewardship pages large owner history without widening scope', (t) =>
  scenarios.stewardship(t));

test('task clarification pages large retained feedback without changing its goal', (t) =>
  scenarios.clarification(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
