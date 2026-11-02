import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { loadBindings, type Bindings } from '../../../../dist/library/architecture/bindings.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { StewardSession } from '../../../../dist/library/assignment/steward.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { minimalWorkflowFixture as workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Reconstructs sessions between real SDK-boundary turns against a controlled executable. */
class ContinuationScenarios {
  /** Ensures reopening neither reruns specification nor loses frozen evidence or thread continuity. */
  async resume(t: TestContext, missingThread = false): Promise<void> {
    const f = workflowFixture(t);
    f.configure({ missingThread });
    this.prepareState(f.state);
    let record = this.record(f);
    const stages: unknown[] = [];
    for (let index = 0; index < 4; index++) {
      const session = new StewardSession(
        f.state,
        record,
        'sample',
        'Improve behavior',
        'gpt-6-luna',
        f.executable,
        new AbortController().signal,
      );
      await session.step();
      stages.push(record.nextStage);
      record = JSON.parse(
        readFileSync(join(f.state, 'runs', record.id, 'report.json'), 'utf8'),
      ) as RecordData;
    }
    this.assertCompleted(record, stages);
    if (missingThread) assert.equal(record.threadId, 'replacement-thread');
  }

  /** Requires passing characterization before and after a refactor without fabricated specification edits. */
  async refactor(t: TestContext): Promise<void> {
    const f = workflowFixture(t);
    this.refactorContract(f);
    f.configure({ refactor: true });
    f.commit();
    this.prepareState(f.state);
    const record = this.record(f);
    this.refactorAuthority(record, f.repo);
    record.directionAccepted = true;
    for (let stage = 0; stage < 4; stage++)
      await new StewardSession(
        f.state,
        record,
        'sample',
        'Normalize whitespace',
        'gpt-6-luna',
        f.executable,
        new AbortController().signal,
      ).step();
    this.assertRefactor(record);
  }

  /** Routes characterization directly through its captured operation instead of a private cross-owner import. */
  private refactorContract(f: ReturnType<typeof workflowFixture>): void {
    writeFileSync(
      join(f.repo, 'tests/baseline.cjs'),
      "require('node:assert/strict').equal(require('node:fs').readFileSync('source.txt','utf8').trim(),'before');",
    );
    const path = join(f.repo, 'architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...operation, args: ['tests/baseline.cjs'] }));
  }

  /** Checks distinct before/after characterization evidence and unchanged documentation. */
  private assertRefactor(record: RecordData): void {
    assert.equal(record.status, 'completed');
    assert.equal(record.characterization, true);
    assert.equal(record.regressionCheckpoint, undefined);
    assert.ok(
      record.commands.some((c) => c.stage === 'characterization-before' && c.exitCode === 0),
    );
    assert.ok(
      record.commands.some((c) => c.stage === 'characterization-after' && c.exitCode === 0),
    );
    assert.equal(readFileSync(join(record.workspace, 'docs/behavior.md'), 'utf8'), 'Before');
  }

  /** Captures the unchanged behavioral contract before any refactor stage. */
  private refactorAuthority(record: RecordData, repository: string): void {
    record.resolvedAssignment = resolveAssignment(repository, record.base, 'sample', {
      bindings: record.bindings as Bindings,
      value: {
        schemaVersion: 3,
        kind: 'change',
        changeType: 'refactor',
        objective: 'Normalize whitespace',
        expectedOutcome: 'Preserve trimmed value',
        acceptanceCriteria: ['Trimmed value remains before'],
        hostChecks: [],
      },
    });
  }

  /** Checks retained engineering evidence and the actual candidate after reopening. */
  private assertCompleted(record: RecordData, stages: unknown[]): void {
    assert.equal(record.status, 'completed');
    assert.deepEqual(stages, ['specification', 'implementation', 'review', 'finished']);
    assert.equal(record.implementationAttempts, 1);
    assert.equal((record.turns as unknown[]).length, 4);
    assert.ok((record.frozenTests as unknown[]).length);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
  }

  /** Captures the same local binding and minimal authority used by a production prepared assignment. */
  private record(f: ReturnType<typeof workflowFixture>): RecordData {
    const bindings = loadBindings(join(f.root, 'minimal-bindings.json'));
    const record = createWorkspace(f.state, { project: f.repo, bindings });
    record.resolvedAssignment = resolveAssignment(f.repo, record.base, 'sample', {
      objective: 'Improve behavior',
      bindings,
    });
    return record;
  }

  /** Establishes the state directories normally created by the CLI entry point. */
  private prepareState(root: string): void {
    for (const name of ['runs', 'workspaces']) mkdirSync(join(root, name), { recursive: true });
  }
}

const scenarios = new ContinuationScenarios();

test('built steward resumes persisted stages without resetting evidence', (t) =>
  scenarios.resume(t));

test('a confirmed missing thread receives a fresh validated continuation', (t) =>
  scenarios.resume(t, true));

test('refactor retains passing characterization without changed specification', (t) =>
  scenarios.refactor(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
