import { loadProjectBindings } from '../../../../dist/library/architecture/bindings.js';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { git } from '../../../../dist/library/operations/process.js';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Adds captured collaboration grants to the controlled-model production-host fixture. */
class SimulationFixture {
  readonly general: GeneralFixture;

  readonly host: ProjectHost;

  readonly context;

  /** Keeps scripted input solely inside acceptance while exercising real storage, Git and confinement. */
  constructor(t: TestContext) {
    this.general = new GeneralFixture(t);
    this.policy();
    this.context = new ExecutionContext().resolve(this.general.fixture.repo);
    this.host = new ProjectHost(this.general.fixture.state, this.context);
    t.after(() => this.host.close());
  }

  /** Grants two shared upstream actions without overriding the host scheduler or model adapter. */
  private policy(): void {
    const f = this.general.fixture;
    const path = join(f.repo, 'architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    for (const [id, action] of [
      ['track', 'issue.create'],
      ['comment', 'issue.comment'],
    ]) {
      platform.operations[id!] = ['agent'];
      writeFileSync(
        join(f.repo, `architecture/operations/${id}.yaml`),
        JSON.stringify({
          schemaVersion: 4,
          id,
          action,
          kind: 'upstream',
          purpose: 'Controlled collaboration',
          repository: 'sample',
          cwd: '.',
          category: 'cli-check',
          activities: [],
          generatedDirectories: [],
          artifacts: [],
        }),
      );
    }
    writeFileSync(path, JSON.stringify(platform));
    f.commit();
  }

  /** Confirms setup and fair rotation do not create upstream resources for empty turns. */
  assertIdleActivity(environmentId: string): number {
    const calls = readFileSync(this.general.fixture.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(calls.filter((call) => call.prompt.includes('Workday setup:')).length, 1);
    assert.equal(
      calls.filter((call) => call.prompt.includes('Self-directed stewardship for')).length,
      3,
    );
    assert.equal(
      existsSync(
        join(
          this.general.fixture.state,
          'projects',
          this.context.key,
          'environments',
          environmentId,
          'evidence-package.jsonl',
        ),
      ),
      true,
      'collaboration is captured in the namespace evidence package',
    );
    return calls.length;
  }

  /** Requires scheduler-generated waits and verified deliveries in the captured evidence package. */
  assertProgress(environmentId: string): void {
    const captured = this.packageEntries(environmentId);
    assert.equal(captured.filter((entry) => entry.operation === 'issue.create').length, 1);
    const milestones = captured
      .filter((entry) => entry.operation === 'issue.comment')
      .map((entry) => String(entry.payload.body));
    assert.equal(
      milestones.filter((body) => /\*\*[abc]: verified component delivery\*\*/.test(body)).length,
      3,
    );
    assert.ok(milestones.some((body) => /\*\*[abc]: waiting\*\*/.test(body)));
    assert.ok(
      milestones.every((body) =>
        body.includes('A component delivery does not establish task completion'),
      ),
    );
  }

  /** Requires the run to work in its own checkout, never the repository it was started from. */
  assertIsolatedWorkspace(run: { data: Record<string, unknown>; environment?: unknown }): void {
    const workspace = run.data.workspace as {
      source: string;
      workspace: string;
      executionEnvironment: unknown;
    };
    assert.notEqual(workspace.source, this.general.fixture.repo);
    assert.deepEqual(workspace.executionEnvironment, run.environment);
    assert.equal(
      loadProjectBindings(workspace.workspace).materializations!.sample!.source,
      workspace.workspace,
    );
  }

  /** Requires exactly one tracking record captured in that namespace's package. */
  assertTracking(environmentId: string): void {
    assert.equal(
      this.packageEntries(environmentId).filter((entry) => entry.operation === 'issue.create')
        .length,
      1,
      'exactly one tracking record captured in that namespace',
    );
  }

  /** Reads the captured collaboration package directly, independently of any execution report. */
  packageEntries(
    environmentId: string,
  ): Array<{ operation: string; payload: Record<string, unknown> }> {
    const path = join(
      this.general.fixture.state,
      'projects',
      this.context.key,
      'environments',
      environmentId,
      'evidence-package.jsonl',
    );
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as { operation: string; payload: Record<string, unknown> });
  }
}

test('simulation uses isolated Git source and creates tracking before the first engineering activation', async (t) => {
  const f = new SimulationFixture(t);
  const original = f.general.fixture.git('rev-parse', 'HEAD');
  const task = f.host.submit('Research the supplier chain', true);
  await f.host.tick();
  const retained = f.host.store.run(task.id);
  assert.equal(retained.status, 'running', JSON.stringify(retained.data));
  assert.equal(retained.environment!.mode, 'simulation');
  assert.equal(retained.data.initialized, true);
  f.assertIsolatedWorkspace(retained);
  f.assertTracking(String(retained.environment!.id));
  assert.ok(f.host.store.assignments(task.id).every((a) => !a.data.recordId));
  assert.equal(f.general.fixture.git('rev-parse', 'HEAD'), original);
  assert.equal(f.general.fixture.git('status', '--porcelain'), '');
  f.host.cancel(task.id);
});

test(
  'simulated task retains environment through nested engineering and independent verification',
  { timeout: 120000 },
  async (t) => {
    const f = new SimulationFixture(t);
    const task = f.host.submit('Research the supplier chain', true);
    for (
      let watchdog = 0;
      watchdog < 100 && f.host.store.run(task.id).status === 'running';
      watchdog++
    )
      await f.host.tick();
    const retained = f.host.store.run(task.id);
    assert.equal(retained.status, 'completed', JSON.stringify(retained.data));
    assert.deepEqual(
      f.host.store
        .assignments(task.id)
        .map((a) => a.owner)
        .sort(),
      ['a', 'b', 'c'],
    );
    const records = readdirSync(join(f.general.fixture.state, 'runs'))
      .map((id) =>
        JSON.parse(readFileSync(join(f.general.fixture.state, 'runs', id, 'report.json'), 'utf8')),
      )
      .filter((record) => record.executionRunId === task.id);
    assert.ok(records.some((record) => record.activationRole === 'verifier'));
    assert.ok(records.some((record) => record.activationRole === 'director'));
    for (const record of records)
      assert.deepEqual(record.executionEnvironment, retained.environment);
    f.assertProgress(retained.environment!.id);
    assert.equal(f.general.fixture.git('status', '--porcelain'), '');
  },
);

test('changed simulation push destinations fail before another model activation', async (t) => {
  const f = new SimulationFixture(t);
  const task = f.host.submit('Research the supplier chain', true);
  await f.host.tick();
  const prepared = f.host.store.run(task.id);
  assert.equal(prepared.status, 'running', JSON.stringify(prepared.data));
  const source = (prepared.data.workspace as { source: string }).source;
  git(source, 'remote', 'set-url', '--push', 'origin', 'https://example.invalid/forbidden.git');
  await f.host.tick();
  const retained = f.host.store.run(task.id);
  assert.equal(retained.status, 'needs_attention');
  assert.match(String(retained.data.error), /materialization changed/);
  assert.ok(f.host.store.assignments(task.id).every((assignment) => !assignment.data.recordId));
  assert.equal(
    f
      .packageEntries(String(retained.environment!.id))
      .filter((entry) => entry.operation === 'issue.create').length,
    1,
    'exactly one tracking record captured in that namespace',
  );
  f.host.cancel(task.id);
});

test(
  'simulated workday directs setup once then rotates actual eligible stewards to idle',
  { timeout: 60000 },
  async (t) => {
    const f = new SimulationFixture(t);
    f.host.control('start', true);
    const workday = f.host.store.runs()[0]!;
    for (
      let watchdog = 0;
      watchdog < 10 && f.host.store.run(workday.id).status === 'running';
      watchdog++
    )
      await f.host.tick();
    const retained = f.host.store.run(workday.id);
    assert.equal(retained.status, 'idle', JSON.stringify(retained.data));
    assert.equal(retained.data.initialized, true);
    assert.deepEqual(
      Object.keys(retained.data.seen as object).sort(),
      f.context.owners.slice().sort(),
    );
    const callCount = f.assertIdleActivity(retained.environment!.id);
    await f.host.tick();
    assert.equal(
      readFileSync(f.general.fixture.calls, 'utf8').trim().split('\n').length,
      callCount,
    );
    f.host.control('stop');
  },
);

test('same-mode tasks share a workday environment while different modes retain separate candidates', (t) => {
  const f = new SimulationFixture(t);
  f.host.control('start', true);
  const workday = f.host.store.runs()[0]!;
  f.host.control('pause');
  const simulated = f.host.submit('Continue within the simulated workday', true);
  const live = f.host.submit('Use the real destination', false);
  assert.deepEqual(simulated.environment, workday.environment);
  assert.notEqual(live.environment!.id, workday.environment!.id);
  assert.equal(live.environment!.mode, 'live');
  assert.equal(f.host.store.run(workday.id).data.pauseReason, 'user');
  f.host.cancel(simulated.id);
  f.host.cancel(live.id);
  f.host.control('stop');
});

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
