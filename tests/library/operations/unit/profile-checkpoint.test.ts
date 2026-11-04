import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { OperationExecution } from '../../../../dist/library/operations/operation-execution.js';
import { OperationCheckpoint } from '../../../../dist/library/operations/operation-checkpoint.js';
import {
  normalizeOperation,
  OperationArguments,
} from '../../../../dist/library/operations/operation-definition.js';
import type { Operation } from '../../../../dist/library/operations/operations.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises test-profile applicability against real candidate files with captured owner authority. */
class ProfileCheckpointScenarios {
  /** Empty implicit selections are explicit non-applicability, never an unrestricted Node invocation. */
  empty(t: TestContext): void {
    const { record, operation } = this.fixture(t);
    const planner = new OperationCheckpoint(record);
    assert.deepEqual(planner.resolve([{ operation, purpose: 'baseline' }]), []);
    assert.deepEqual(planner.notApplicable, [
      {
        operationId: 'tests',
        ownerId: 'sample',
        profile: 'node',
        purpose: 'baseline',
      },
    ]);
    operation.profileVerification = undefined;
    assert.throws(() => planner.resolve([{ operation, purpose: 'verify' }]), /Empty or unsafe/);
  }

  /** The executor retains non-applicability separately from successful command evidence. */
  async observation(t: TestContext): Promise<void> {
    const { record, operation } = this.fixture(t);
    record.id = 'profile-check';
    mkdirSync(join(record.workspace, 'runs', record.id), { recursive: true });
    const executor = new OperationExecution(record.workspace, record, new AbortController().signal);
    assert.deepEqual(await executor.checkpoint([operation], 'baseline'), []);
    const event = JSON.parse(
      readFileSync(join(record.workspace, 'runs', record.id, 'timeline.jsonl'), 'utf8'),
    );
    assert.equal(event.type, 'operation.not_applicable');
    assert.equal(event.payload.operationId, 'tests');
    assert.deepEqual(record.operationInvocations ?? [], []);
    await assert.rejects(executor.run(operation, 'regression'), /no applicable test suites/);
  }

  /** A first suite created after capture becomes mandatory in both assignment and assembled checkpoints. */
  firstSuite(t: TestContext, assignment: boolean): void {
    const { record, operation, owner } = this.fixture(t);
    if (assignment) record.resolvedAssignment = { context: [owner] };
    writeFileSync(
      join(record.workspace, 'tests/unit/first.test.ts'),
      "registerSuite({ component: 'sample', level: 'unit', tags: ['deterministic'] });\n",
    );
    const planner = new OperationCheckpoint(record);
    const steps = planner.resolve([{ operation, purpose: 'verify' }]);
    assert.equal(steps.length, 1);
    assert.ok(steps[0]!.operation.kind === 'command');
    assert.deepEqual(steps[0]!.operation.args, ['--test', '.test-build/unit/first.test.js']);
    assert.deepEqual(planner.notApplicable, []);
    assert.deepEqual(
      steps[0]!.operation.selectedTests?.map((suite) => suite.state),
      ['added'],
    );
  }

  /** Foreign suite metadata is rejected before preparing or executing a test operation. */
  foreign(t: TestContext): void {
    const { record, operation } = this.fixture(t);
    writeFileSync(
      join(record.workspace, 'tests/unit/foreign.test.ts'),
      "registerSuite({ component: 'other', level: 'unit' });\n",
    );
    assert.throws(
      () => new OperationCheckpoint(record).resolve([{ operation, purpose: 'verify' }]),
      /owner|component/i,
    );
  }

  /** Creates an isolated empty test root and one captured implicit profile operation. */
  private fixture(t: TestContext) {
    const workspace = mkdtempSync(join(tmpdir(), 'arcnexus-profile-check-'));
    t.after(() => rmSync(workspace, { recursive: true, force: true }));
    mkdirSync(join(workspace, 'tests/unit'), { recursive: true });
    const operation = this.operation();
    const owner = {
      schemaVersion: 6,
      id: 'sample',
      repository: 'sample',
      repositoryRoot: '.',
      allowedWritePaths: ['tests'],
      access: { readPaths: ['.'] },
      testProfile: 'node',
      capturedTests: [],
      operationPlan: { verify: [operation] },
    };
    const record = { workspace, operationCatalog: [owner] } as unknown as RecordData;
    return { record, operation, owner };
  }

  /** Captures deferred test argv without granting a caller permission to select arbitrary paths. */
  private operation(): Operation {
    const operation = normalizeOperation({
      schemaVersion: 4,
      id: 'tests',
      repository: 'sample',
      kind: 'command',
      command: 'node',
      args: ['--test', { context: 'selectedTestFiles' }],
      cwd: '.',
      generatedDirectories: ['.test-build'],
      artifacts: [],
      category: 'cli-check',
      activities: ['testing'],
      purpose: 'Test selected suites',
    } as unknown as Operation);
    return {
      ...new OperationArguments().capture(
        operation,
        {
          ownerId: 'sample',
          ownedPaths: ['tests'],
          packageRoot: '.',
          selectedTestFiles: [],
          testOutputRoot: '.test-build',
        },
        true,
      ),
      profileVerification: 'node',
    };
  }
}

const scenarios = new ProfileCheckpointScenarios();

test('implicit empty profile verification is inapplicable but explicit verification fails', (t) =>
  scenarios.empty(t));

test('first new suite is required by the captured assignment profile', (t) =>
  scenarios.firstSuite(t, true));

test('assembled delivery refreshes current owner suites without replacing captured authority', (t) =>
  scenarios.firstSuite(t, false));

test('profile verification rejects foreign suite metadata before dispatch', (t) =>
  scenarios.foreign(t));

test('empty implicit checks retain non-applicability without passing command evidence', (t) =>
  scenarios.observation(t));

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic', 'scoped-checks'] });
