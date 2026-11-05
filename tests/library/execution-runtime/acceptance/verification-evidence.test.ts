import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { EvidencePages } from '../../../../dist/library/report/report.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { Direction } from '../../../../dist/library/task-intake/direction.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Verifies the independent model receives immutable host change evidence through a constrained tool. */
class VerificationEvidenceScenarios {
  /** Independent verification receives original worker assertions and their current comparison as evidence. */
  async regressions(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, false);
    const original = Buffer.from('mistaken incidental assertion');
    record.frozenTests = [
      {
        path: 'source.txt',
        content: original.toString('base64'),
        sha256: createHash('sha256').update(original).digest('hex'),
      },
    ];
    record.regressionCheckpoint = { exitCode: 1, outputIncludes: 'EXPECTED_BEHAVIOR' };
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE',
      { criteria: ['Original behavior remains covered'] },
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    const comparison = JSON.parse(trace.artifacts.regressions);
    assert.equal(comparison.files[0].status, 'changed');
    assert.deepEqual(comparison.expectedFailure, record.regressionCheckpoint);
    assert.equal(trace.artifacts['regression:source.txt'], original.toString('base64'));
    assert.equal(
      readFileSync(join(record.workspace, 'source.txt'), 'utf8'),
      'observed candidate change\n',
    );
  }

  /** Goal assessment retrieves large exact input instead of duplicating retained assignments in its prompt. */
  async large(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, true);
    const input = [{ acceptance: ['Observed scope'], notes: 'x'.repeat(1100000) }];
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE LARGE_ASSESSMENT',
      input,
      true,
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    assert.deepEqual(JSON.parse(trace.artifacts.assessment), input);
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const prompt = calls.find((call) =>
      call.prompt.startsWith('Independent read-only verification.'),
    ).prompt;
    assert.ok(prompt.length < 100000, 'Goal prompt must not inline retained assignment records');
  }

  /** Both owner and whole-goal assessments can inspect accumulated tracked and untracked changes. */
  async inspect(t: TestContext, goal: boolean, retryPage = false): Promise<void> {
    const { f, context, record } = await this.fixture(t, goal);
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE: confirm exact candidate changes ' +
        (retryPage ? 'RETRY_INVALID_PAGE' : ''),
      goal ? [] : { criteria: ['Scope is observed'] },
      goal,
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    assert.equal(trace.manifest.baseline, context.base);
    assert.deepEqual(
      trace.manifest.changes.map((change: any) => change.path),
      ['docs/evidence.md', 'source.txt'],
    );
    assert.match(trace.artifacts.patch, /observed candidate change/);
    const addition = trace.manifest.artifacts.find(
      (artifact: any) => artifact.path === 'docs/evidence.md',
    );
    if (!goal) assert.equal(trace.artifacts[addition.id], 'New captured evidence\n');
    assert.equal(
      readFileSync(join(record.workspace, 'source.txt'), 'utf8'),
      'observed candidate change\n',
    );
  }

  /** Artifact names are fixed host capabilities and cannot be used to read arbitrary evidence-directory paths. */
  async forbidden(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, false);
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE FORBIDDEN_ARTIFACT',
      { criteria: ['Scope is observed'] },
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    assert.match(trace.artifacts.patch, /observed candidate change/);
    assert.equal(trace.artifacts['../report.json'], undefined);
    assert.equal(trace.artifacts['supplier:edit:foreign.json'], undefined);
  }

  /** Complete command logs are discoverable from the current manifest without duplicating them in its index. */
  async commandOutputs(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, false);
    record.executionRunId = 'current-run';
    const commands = this.commandObservations();
    const evidence = {
      run: { id: 'current-run' },
      assignments: [{ id: 'assignment', record: { observations: { hostCommands: commands } } }],
    };
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE',
      { criteria: ['Observed logs'] },
      false,
      evidence,
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    const index = JSON.parse(trace.artifacts.execution);
    const indexed = index.assignments[0].record.observations.hostCommands;
    assert.equal(trace.artifacts[indexed[0].output.artifact], commands[0]!.output.content);
    assert.equal(trace.artifacts[indexed[1].output.artifact], '');
    assert.equal(indexed[0].exitCode, 0);
    assert.equal(indexed[1].stage, 'captured-acceptance');
    assert.equal('content' in indexed[0].output, false);
    assert.deepEqual(indexed[2], commands[2]);
    assert.equal(commands[0]!.output.content, 'Observed check\n'.repeat(20));
  }

  /** The independent verifier retrieves exact investigation bytes from its own current MCP manifest. */
  async investigation(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, false);
    record.executionRunId = 'current-run';
    const evidence = this.investigationEvidence(f.state);
    await new Direction(f.state, context, new AbortController().signal).verify(
      record,
      'a',
      'READ_HOST_EVIDENCE',
      { criteria: ['Observed investigation'] },
      false,
      evidence,
    );
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    const index = JSON.parse(trace.artifacts.execution);
    const observed =
      index.assignments[0].record.observations.timeline.events[0].payload.item.result;
    assert.equal(
      trace.artifacts[observed.verificationArtifacts[0].verificationArtifact],
      '{"transaction":"committed"}',
    );
    assert.equal(
      evidence.assignments[0]!.record.observations.timeline.events[0]!.payload.item.result
        .verificationArtifact,
      undefined,
    );
  }

  /** Pins a genuine investigation artifact in a same-run worker record before verification starts. */
  private pinInvestigation(root: string) {
    const id = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        id,
        executionRunId: 'current-run',
        assignmentId: 'investigation',
      }),
    );
    const pages = new EvidencePages('assignment.evidence');
    pages.add('unread-receipt', '{"transaction":"committed"}', 'json');
    pages.add(
      'manifest',
      JSON.stringify({
        runId: 'current-run',
        assignmentId: 'investigation',
        artifacts: pages.metadata(),
      }),
      'json',
    );
    pages.retain(directory, {});
    return { id, sha256: pages.metadata().find((artifact) => artifact.id === 'manifest')!.sha256 };
  }

  /** Connects the retained artifact to a completed same-run investigation observation. */
  private investigationEvidence(root: string) {
    const { id, sha256 } = this.pinInvestigation(root);
    const result: any = {
      contentRetainedInPinnedArtifact: true,
      artifact: 'manifest',
      sha256,
    };
    const event = {
      runId: id,
      type: 'codex.event',
      payload: {
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          server: 'arcnexus',
          tool: 'assignment.evidence',
          result,
        },
      },
    };
    const record = { recordId: id, observations: { timeline: { events: [event] } } };
    return { run: { id: 'current-run' }, assignments: [{ id: 'investigation', record }] };
  }

  /** Supplies populated, empty and unavailable outputs with distinct observed completion metadata. */
  private commandObservations() {
    return [
      {
        index: 0,
        stage: 'verification',
        exitCode: 0,
        output: { content: 'Observed check\n'.repeat(20) },
      },
      { index: 1, stage: 'captured-acceptance', exitCode: 0, output: { content: '' } },
      { index: 2, stage: 'verification', exitCode: null, output: { evidenceUnavailable: true } },
    ];
  }

  /** A caller cannot attach another run's host facts to an otherwise valid current candidate. */
  async foreignRun(t: TestContext): Promise<void> {
    const { f, context, record } = await this.fixture(t, false);
    record.executionRunId = 'current-run';
    await assert.rejects(
      () =>
        new Direction(f.state, context, new AbortController().signal).verify(
          record,
          'a',
          'READ_HOST_EVIDENCE',
          { criteria: ['Observed'] },
          false,
          { run: { id: 'foreign-run' } },
        ),
      /different run/,
    );
  }

  /** Creates real isolated candidate changes, optionally materializing them as a clean accumulated snapshot. */
  private async fixture(t: TestContext, goal: boolean) {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    for (const name of ['runs', 'workspaces']) mkdirSync(join(f.state, name), { recursive: true });
    let record = createWorkspace(f.state, { project: f.repo, bindings: context.bindings });
    await prepareWorkspace(f.state, record, new AbortController().signal);
    writeFileSync(join(record.workspace, 'source.txt'), 'observed candidate change\n');
    writeFileSync(join(record.workspace, 'docs/evidence.md'), 'New captured evidence\n');
    if (goal) {
      const snapshots = new CandidateSnapshots(f.repo, join(f.state, 'snapshots'));
      const base = snapshots.capture(record.workspace, record.base);
      record = createWorkspace(f.state, {
        project: f.repo,
        base,
        authorityBase: context.base,
        bindings: context.bindings,
      });
      await prepareWorkspace(f.state, record, new AbortController().signal);
    }
    return { f, context, record };
  }
}

const scenarios = new VerificationEvidenceScenarios();

for (const goal of [false, true])
  test(
    'read-only verification receives complete host evidence for ' +
      (goal ? 'the accumulated goal' : 'an owner delivery'),
    (t) => scenarios.inspect(t, goal),
  );

test('verification retries an invalid page without losing pinned evidence', (t) =>
  scenarios.inspect(t, false, true));

test('verification rejects foreign artifacts and resumes valid reads on the same MCP connection', (t) =>
  scenarios.forbidden(t));

test('verification indexes complete and empty command logs without mutating retained evidence', (t) =>
  scenarios.commandOutputs(t));

test('verification rejects host evidence attached from a foreign run', (t) =>
  scenarios.foreignRun(t));

test('verification retrieves referenced investigation bytes through its own MCP manifest', (t) =>
  scenarios.investigation(t));

test('goal assessment pages more than one megabyte of exact submitted input', (t) =>
  scenarios.large(t));

test('independent verification inspects original regression and corrected candidate', (t) =>
  scenarios.regressions(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
