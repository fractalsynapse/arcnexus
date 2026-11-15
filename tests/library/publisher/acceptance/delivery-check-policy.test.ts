import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as deterministicTest, type TestContext } from 'node:test';
import { MinimalCatalogFixture } from '../../testing/support/minimal-catalog-fixture.js';

/**
 * Declares the activities the fixture's director component needs.
 *
 * Operations are reached through a declared activity, so the fixture states them the way a real
 * component does: `research` because the platform names this leaf as its director, and `testing`
 * because that is where the captured verification operation is bound.
 */
const changelogActivities = (): Record<string, unknown> => ({
  research: {
    role: 'engineer',
    profile: 'luna',
    operations: [],
    instructions: ['Establish what the assembled delivery actually contains before it is checked'],
  },
  testing: {
    role: 'engineer',
    profile: 'luna',
    operations: ['fixture-proof'],
    instructions: ['Prove the assembled change against the declared verification input'],
  },
});

import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import type {
  ExecutionRun,
  ExecutionAssignment,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { OperationExecution } from '../../../../dist/library/operations/operation-execution.js';
import { DeliveryChecks } from '../../../../dist/library/publisher/delivery-checks.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Checks assembled publication policy through actual workspace and supervised operation wiring. */
class DeliveryCheckPolicyScenario {
  /** Adds an independently failing check without changing engineering requirements. */
  private policy(repo: string): void {
    const path = join(repo, '.arc/architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    platform.operations['delivery-proof'] = ['delivery'];
    writeFileSync(path, JSON.stringify(platform));
    writeFileSync(
      join(repo, '.arc/architecture/operations/delivery-proof.json'),
      JSON.stringify({
        schemaVersion: 4,
        id: 'delivery-proof',
        kind: 'command',
        repository: 'sample',
        purpose: 'Require assembled delivery evidence',
        cwd: '.',
        category: 'cli-check',
        activities: [],
        command: 'node',
        args: ['-e', 'process.exit(7)'],
        generatedDirectories: [],
        artifacts: [],
        prerequisites: [],
      }),
    );
  }

  /** Requires a delivery-only failure to block publication and retain the actual command evidence. */
  async run(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    mkdirSync(join(f.state, 'runs'), { recursive: true });
    mkdirSync(join(f.state, 'workspaces'), { recursive: true });
    this.policy(f.repo);
    f.commit();
    const context = new ExecutionContext().resolve(f.repo);
    assert.ok(
      !context.catalog.components.a!.verification.some(
        (op) => 'id' in op && op.id === 'delivery-proof',
      ),
    );
    const run = {
      id: 'delivery-policy',
      mode: 'task',
      objective: 'Verify assembled policy',
    } as ExecutionRun;
    const assignments = [
      { owner: 'a', acceptance: ['Observed checks pass'] },
    ] as ExecutionAssignment[];
    const result = await new DeliveryChecks(f.state, context, run, assignments).check(
      context.base,
      new AbortController().signal,
    );
    assert.equal(result.status, 'failed');
    this.evidence(result.evidence[0]!);
  }

  /** Distinguishes observed check failure from missing confinement or preparation. */
  private evidence(path: string): void {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const invocation = report.operationInvocations.find(
      (entry: any) => entry.operationId === 'delivery-proof',
    );
    assert.equal(invocation.status, 'failed');
    assert.equal(invocation.result.exitCode, 7);
    assert.equal(invocation.purpose, 'publication-verify');
  }
}

test('assembled delivery executes inherited delivery-only checks and retains their failure', (t) =>
  new DeliveryCheckPolicyScenario().run(t));

/** Adds publisher delivery state to the testing library's declared catalog fixture. */
class PublisherChangelogFixture extends MinimalCatalogFixture {
  readonly repo = this.root;

  readonly state: string;

  /** Keeps delivery state outside the candidate repository and removes it after the case. */
  constructor(t: TestContext) {
    super(t);
    this.state = mkdtempSync(join(tmpdir(), 'publisher-delivery-state-'));
    t.after(() => rmSync(this.state, { recursive: true, force: true }));
  }

  /** Commits a candidate snapshot for the public assembled checker. */
  commit(): void {
    this.git('add', '.');
    this.git('commit', '-qm', 'candidate update');
  }
}

/** Exercises changelog policy on real assembled records with controlled successful operations. */
class AssembledChangelogScenario {
  readonly fixture: PublisherChangelogFixture;

  readonly context: ReturnType<ExecutionContext['resolve']>;

  readonly assemblyBase: string;

  /** Captures classification before an unrelated delivery advances the engineering baseline. */
  constructor(t: TestContext) {
    this.fixture = new PublisherChangelogFixture(t);
    t.mock.method(OperationExecution.prototype, 'checkpoint', async () => []);
    this.execution();
    this.classification();
    this.repository();
    this.context = new ExecutionContext().resolve(this.fixture.repo);
    this.fixture.put('CHANGELOG.md', 'Prior delivery changelog');
    this.fixture.commit();
    this.assemblyBase = this.fixture.git('rev-parse', 'HEAD');
    mkdirSync(join(this.fixture.state, 'runs'), { recursive: true });
    mkdirSync(join(this.fixture.state, 'workspaces'), { recursive: true });
  }

  /** Supplies current execution declarations without adding applicable sandbox operations. */
  private execution(): void {
    const f = this.fixture;
    f.put('.arc/architecture/environment.json', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
    const path = '.arc/architecture/components/platform.json';
    const platform = JSON.parse(readFileSync(join(f.repo, path), 'utf8'));
    Object.assign(platform, {
      director: { component: 'sample', profile: 'luna' },
      reviewerProfile: 'luna',
      defaultPackage: 'package',
    });
    f.put(path, platform);
    f.put('.arc/architecture/execution-profiles/luna.json', {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['cli-check'],
    });
  }

  /** Retains classification overrides in the package where captured rules are declared. */
  private classification(): void {
    const f = this.fixture;
    const definition = JSON.parse(
      readFileSync(join(f.repo, '.arc/architecture/components/package.json'), 'utf8'),
    );
    definition.classification = [
      { path: 'source.asset', kind: 'source' },
      { path: 'docs', kind: 'documentation' },
    ];
    f.put('.arc/architecture/components/package.json', definition);
  }

  /** Creates owned candidate files and one captured verification operation for the controlled executor. */
  private repository(): void {
    const f = this.fixture;
    rmSync(join(f.repo, 'tests'), { recursive: true, force: true });
    f.put('.arc/architecture/components/sample.json', {
      schemaVersion: 6,
      id: 'sample',
      type: 'library',
      parentId: 'package',
      purpose: 'Own the assembled changelog fixture',
      owns: ['source.asset', 'docs', 'tests', 'CHANGELOG.md'],
      operations: { 'fixture-proof': ['verify'] },
      activities: changelogActivities(),
    });
    this.operation();
    for (const path of ['source.asset', 'docs/guide.asset', 'tests/case.txt', 'CHANGELOG.md'])
      f.put(path, 'Before');
    f.commit();
  }

  /** Declares the finite verification input without claiming the controlled executor proves confinement. */
  private operation(): void {
    this.fixture.put('.arc/architecture/operations/fixture-proof.json', {
      schemaVersion: 4,
      id: 'fixture-proof',
      kind: 'command',
      repository: 'sample',
      purpose: 'Controlled successful check',
      cwd: '.',
      category: 'cli-check',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      generatedDirectories: [],
      artifacts: [],
      prerequisites: [],
    });
  }

  /** Runs the public checker on a committed candidate with a distinct retained assembly parent. */
  async check(path: string, changelog = false) {
    const f = this.fixture;
    f.put(path, 'After');
    if (changelog) f.put('CHANGELOG.md', 'Current source change');
    f.commit();
    const run = {
      id: 'changelog-policy',
      mode: 'task',
      objective: 'Require assembled source changelog',
    } as ExecutionRun;
    const assignments = [
      { owner: 'sample', acceptance: ['Source changes include a changelog'] },
    ] as ExecutionAssignment[];
    const checker = new DeliveryChecks(f.state, this.context, run, assignments);
    const record = checker.record(f.git('rev-parse', 'HEAD'));
    record.assemblyBase = this.assemblyBase;
    assert.notEqual(record.base, record.assemblyBase);
    assert.notEqual(record.assemblyBase, this.context.base);
    const result = await checker.checkRecord(record, new AbortController().signal);
    return { result, report: JSON.parse(readFileSync(result.evidence[0]!, 'utf8')) };
  }
}

deterministicTest(
  'assembled source changes without CHANGELOG.md retain a validation failure',
  async (t) => {
    const { result, report } = await new AssembledChangelogScenario(t).check('source.asset');
    assert.equal(
      result.status,
      'failed',
      'source changes without CHANGELOG.md must fail assembled verification',
    );
    assert.equal(report.status, 'failed');
    assert.match(report.error, /CHANGELOG\.md/);
    assert.equal(
      report.verdict,
      undefined,
      'a validation refusal must not retain an accepting verdict',
    );
  },
);

deterministicTest(
  'assembled source changes with CHANGELOG.md satisfy the requirement',
  async (t) => {
    const { result, report } = await new AssembledChangelogScenario(t).check('source.asset', true);
    assert.equal(result.status, 'passed');
    assert.equal(report.status, 'completed');
  },
);

deterministicTest('assembled tests-only changes pass without CHANGELOG.md', async (t) => {
  const { result } = await new AssembledChangelogScenario(t).check('tests/case.txt');
  assert.equal(result.status, 'passed');
});

deterministicTest('assembled documentation-only changes pass without CHANGELOG.md', async (t) => {
  const { result } = await new AssembledChangelogScenario(t).check('docs/guide.asset');
  assert.equal(result.status, 'passed');
});

registerSuite({ component: 'publisher', level: 'acceptance', tags: ['native', 'scoped-checks'] });
