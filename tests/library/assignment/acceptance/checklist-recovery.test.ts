import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { loadBindings } from '../../../../dist/library/architecture/bindings.js';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { StewardSession } from '../../../../dist/library/assignment/steward.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { minimalWorkflowFixture as workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Reproduces real specification edits followed by an invalid completed-turn checklist update. */
class ChecklistRecoveryScenarios {
  /** A real supervised quality failure retains editable specification work before freezing tests. */
  async quality(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'quality-recovery');
    await step();
    const thread = record.threadId;
    await step();
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'specification');
    assert.equal(record.threadId, thread);
    assert.equal(record.frozenTests, undefined);
    assert.equal(record.specificationFinished, false);
    assert.match(String(record.specificationFeedback), /FORMAT_REQUIRED/);
    assert.ok(record.commands.some((command) => command.stage === 'specification-quality'));
    assert.equal(
      record.commands.some((command) => command.stage === 'red-test'),
      false,
    );
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
    for (let stage = 0; stage < 3; stage++) await step();
    assert.equal(record.status, 'completed');
    assert.equal(record.threadId, thread);
    assert.equal(record.specificationFeedback, undefined);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
  }

  /** Preserves the accepted plan and partial specification until a valid correction reaches verification. */
  async correct(t: TestContext): Promise<void> {
    const { f, record, step } = this.fixture(t, 'checklist-recovery');
    await step();
    const plan = structuredClone(record.plan);
    await step();
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'specification');
    assert.deepEqual(
      record.plan,
      plan,
      'Rejected update batches must not change the accepted plan',
    );
    assert.match(String(record.planFeedback), /Checklist completion requires evidence/);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
    assert.notEqual(readFileSync(join(record.workspace, 'docs/behavior.md'), 'utf8'), 'Before');
    const thread = record.threadId;
    for (let stage = 0; stage < 3; stage++) await step();
    assert.equal(record.status, 'completed');
    assert.equal(record.threadId, thread);
    assert.ok(
      record.commands.some((command) => command.stage === 'red-test' && command.exitCode !== 0),
    );
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
    assert.match(
      readFileSync(f.calls, 'utf8'),
      /Populate requests whenever another eligible owner must act/,
    );
  }

  /** Identical invalid completion claims eventually require diagnosis instead of fabricating success. */
  async loop(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'checklist-loop');
    await step();
    for (let failure = 0; failure < 3; failure++) await step();
    await assert.rejects(step, /different action|attention/);
    assert.equal(record.status, 'needs_attention');
    assert.equal(record.safeCheckpoint, false);
    assert.equal((record.plan as any).items[0].status, 'pending');
    assert.equal((record.progress as any).warnings.length, 1);
  }

  /** Partial edits without a completed model response remain unsafe and cannot enter semantic correction. */
  async uncertain(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'checklist-transport');
    await step();
    await assert.rejects(step, /Disconnected before final checklist response/);
    assert.equal(record.safeCheckpoint, false);
    assert.equal(record.planFeedback, undefined);
    assert.notEqual(readFileSync(join(record.workspace, 'docs/behavior.md'), 'utf8'), 'Before');
  }

  /** A captured role without release authority can still finish verified engineering and handoff. */
  async restrictedRole(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'restricted-role');
    for (let stage = 0; stage < 4; stage++) await step();
    assert.equal(record.status, 'completed');
    assert.equal(record.outcome, 'ready_for_integration');
    assert.ok(record.commands.some((command) => command.stage === 'red-test'));
  }

  /** A worker that ignores its output schema cannot obtain forbidden authority through recovery. */
  async forbiddenActivity(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'restricted-violation');
    for (let stage = 0; stage < 3; stage++) await step();
    await assert.rejects(step, /Role cannot perform release/);
    assert.equal(record.safeCheckpoint, false);
    assert.equal(record.status, 'failed');
  }

  /** A completed blocked response preserves the stage and edits without accepting false completion. */
  async blocked(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'safe-blocked');
    await step();
    const plan = structuredClone(record.plan);
    await step();
    assert.equal(record.status, 'blocked');
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'specification');
    assert.deepEqual(record.plan, plan);
    assert.match(String(record.error), /Required contract decision/);
    assert.notEqual(readFileSync(join(record.workspace, 'docs/behavior.md'), 'utf8'), 'Before');
  }

  /** Corrects a completed expected-red diagnostic without losing edits or advancing implementation. */
  async regression(t: TestContext): Promise<void> {
    const { f, record, step } = this.fixture(t, 'regression-recovery');
    await step();
    const thread = record.threadId;
    await step();
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'specification');
    assert.match(String(record.specificationFeedback), /BOUNDARY_EXPECTED/);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
    assert.equal(record.commands.at(-1)?.exitCode, 1);
    for (let stage = 0; stage < 3; stage++) await step();
    assert.equal(record.status, 'completed');
    assert.equal(record.threadId, thread);
    assert.equal(record.specificationFeedback, undefined);
    assert.match(readFileSync(f.calls, 'utf8'), /Specification checkpoint feedback/);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
  }

  /** Repeated completed expected-red mismatches require diagnosis without an attempt quota. */
  async regressionLoop(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'regression-loop');
    await step();
    for (let failure = 0; failure < 3; failure++) await step();
    await assert.rejects(step, /different action|attention/);
    assert.equal(record.status, 'needs_attention');
    assert.equal(record.nextStage, 'specification');
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
  }

  /** Rejects an invalid selection without executing it, then resumes the same specification. */
  async selection(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'selection-recovery');
    await step();
    const thread = record.threadId;
    const commands = record.commands.length;
    await step();
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'specification');
    assert.equal(record.commands.length, commands);
    assert.match(String(record.specificationFeedback), /captured verification/);
    assert.match(String(record.specificationFeedback), /verify/);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
    for (let stage = 0; stage < 3; stage++) await step();
    assert.equal(record.status, 'completed');
    assert.equal(record.threadId, thread);
    assert.ok(record.commands.some((command) => command.stage === 'red-test'));
  }

  /** Changing unknown IDs does not reset equivalent selection-failure diagnosis. */
  async selectionLoop(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'selection-loop');
    await step();
    for (let failure = 0; failure < 3; failure++) await step();
    await assert.rejects(step, /different action|attention/);
    assert.equal(record.status, 'needs_attention');
    assert.equal(record.nextStage, 'specification');
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'before');
  }

  /** A pending final item keeps the completed review correctable at the same checkpoint. */
  async finalClaim(t: TestContext): Promise<void> {
    const { record, step } = this.fixture(t, 'final-checklist');
    for (let stage = 0; stage < 4; stage++) await step();
    assert.equal(record.nextStage, 'review');
    assert.equal(record.safeCheckpoint, true);
    assert.match(String(record.planFeedback), /incomplete or blocked: work/);
    await step();
    assert.equal(record.nextStage, 'finished');
    assert.equal(record.status, 'completed');
  }

  /** Captures an unlimited engineering profile and uses the production resumable session after every turn. */
  private fixture(t: TestContext, mode: string) {
    const f = workflowFixture(t, mode);
    this.configure(f, mode);
    for (const name of ['runs', 'workspaces']) mkdirSync(join(f.state, name), { recursive: true });
    const bindings = loadBindings(join(f.root, 'minimal-bindings.json'));
    const record = createWorkspace(f.state, { project: f.repo, bindings });
    record.resolvedAssignment = resolveAssignment(f.repo, record.base, 'sample', {
      objective: 'Improve behavior',
      bindings,
    });
    record.directionAccepted = true;
    const step = () =>
      new StewardSession(
        f.state,
        record,
        'sample',
        'Improve behavior',
        'gpt-6-luna',
        f.executable,
        new AbortController().signal,
      ).step();
    return { f, record, step };
  }

  /** Captures an unlimited profile with the deterministic planning-aware harness. */
  private configure(f: ReturnType<typeof workflowFixture>, mode: string): void {
    if (mode === 'quality-recovery') this.qualityPolicy(f);
    if (mode.startsWith('restricted-')) {
      const path = join(f.repo, 'architecture/roles/engineer.yaml');
      const role = JSON.parse(readFileSync(path, 'utf8'));
      role.activities = role.activities.filter((activity: string) => activity !== 'release');
      writeFileSync(path, JSON.stringify(role));
      f.commit();
    }
  }

  /** Declares a finite mandatory check that rejects the controlled specification, not its baseline. */
  private qualityPolicy(f: ReturnType<typeof workflowFixture>): void {
    const profilePath = join(f.repo, 'architecture/execution-profiles/luna.yaml');
    const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
    profile.operationCategories.push('lint');
    writeFileSync(profilePath, JSON.stringify(profile));
    const path = join(f.repo, 'architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    operation.id = 'spec-quality';
    operation.category = 'lint';
    operation.args = [
      '-e',
      "const fs=require('fs');const p='tests/regression.cjs';if(fs.existsSync(p)&&!fs.readFileSync(p,'utf8').endsWith('\\n'))throw Error('FORMAT_REQUIRED')",
    ];
    writeFileSync(
      join(f.repo, 'architecture/operations/spec-quality.yaml'),
      JSON.stringify(operation),
    );
    f.component.operations = { 'spec-quality': ['verify'] };
    writeFileSync(join(f.repo, 'architecture/components/sample.json'), JSON.stringify(f.component));
    f.commit();
  }
}

const scenarios = new ChecklistRecoveryScenarios();

test('mandatory source quality fails while specification edits remain correctable', (t) =>
  scenarios.quality(t));

test('completed-turn checklist correction preserves real specification and regression work', (t) =>
  scenarios.correct(t));

test('equivalent completed-turn checklist errors require diagnosis without retry quotas', (t) =>
  scenarios.loop(t));

test('unfinished model transport cannot become a safe checklist correction', (t) =>
  scenarios.uncertain(t));

test('captured role restricts output activities while allowing verified caller handoff', (t) =>
  scenarios.restrictedRole(t));

test('completed blocked response retains a safe unfinished specification checkpoint', (t) =>
  scenarios.blocked(t));

test('forbidden activity claims remain unsafe despite completed transport', (t) =>
  scenarios.forbiddenActivity(t));

test('completed expected-regression mismatch can correct on its retained specification', (t) =>
  scenarios.regression(t));

test('equivalent expected-regression mismatches require diagnosis', (t) =>
  scenarios.regressionLoop(t));

test('invalid regression selection preserves the specification for correction', (t) =>
  scenarios.selection(t));

test('changing invalid regression identities does not bypass progress detection', (t) =>
  scenarios.selectionLoop(t));

test('final review can supply missing checklist evidence at its safe checkpoint', (t) =>
  scenarios.finalClaim(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
