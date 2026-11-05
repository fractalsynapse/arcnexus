import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import {
  stewardEntry,
  minimalWorkflowFixture as workflowFixture,
} from '../../testing/support/workflow-fixture.js';

/** Exercises context behavior through observable scenarios. */
class ContextTests {
  /** Verifies that bound command executes from supplied context with reset pathand read only tool visibility. */
  boundCommandExecutesFromSuppliedContextWithResetPATHAndReadOnlyToolVisibility(t: TestContext) {
    const f = workflowFixture(t),
      bin = join(f.root, 'tool directory');
    mkdirSync(bin);
    const tool = join(bin, 'target-node');
    writeFileSync(tool, '#!/bin/sh\nexec ' + process.execPath + ' "$@"\n', { mode: 0o755 });
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      readFileSync(join(f.repo, 'verify.cjs'), 'utf8') +
        "if(require('child_process').spawnSync('target-node',['-e','process.exit(0)']).status!==0)throw new Error('NESTED_TOOL_UNAVAILABLE');",
    );
    const path = join(f.repo, 'architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    operation.command = 'target-node';
    writeFileSync(path, JSON.stringify(operation));
    f.commit();
    const binding = this.bindTool(f, tool);
    f.configure({ suppliedTool: true });
    const r = f.run('--kind', 'research', '--bindings', binding);
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(r.stdout);
    assert.equal(record.settings.filesystem[bin], 'read');
    assert.ok(calls(f)[0].prompt.includes(tool));
    assert.ok(calls(f)[0].args.some((a: any) => a.includes(JSON.stringify(bin) + '="read"')));
  }

  /** Extends native confinement bindings with the caller's executable without dropping existing tools. */
  private bindTool(f: any, tool: string): string {
    const binding = join(f.root, 'bindings.json');
    const value = JSON.parse(readFileSync(join(f.root, 'minimal-bindings.json'), 'utf8'));
    value.tools['target-node'] = tool;
    writeFileSync(binding, JSON.stringify(value));
    return binding;
  }

  /** Verifies that review receives first parent diff with hash no unrelated history. */
  reviewReceivesFirstParentDiffWithHashNoUnrelatedHistory(t: TestContext) {
    const f = workflowFixture(t);
    writeFileSync(join(f.repo, 'docs/behavior.md'), 'PINNED_REVIEW_CHANGE');
    f.commit();
    f.configure({ reviewEvidence: true });
    const r = f.run('--kind', 'review');
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(r.stdout),
      prompt = calls(f).at(-1).prompt;
    assert.doesNotMatch(prompt, /PINNED_REVIEW_CHANGE/);
    assert.match(this.review(f).patch, /PINNED_REVIEW_CHANGE/);
    assert.match(prompt, /Host review evidence/);
    assert.equal(record.turns.at(-1).reviewEvidence.basis, 'base-first-parent');
    assert.match(record.turns.at(-1).reviewEvidence.sha256, /^[a-f0-9]{64}$/);
  }

  /** Verifies that root revision review and candidate review both receive readable changes. */
  rootRevisionReviewAndCandidateReviewBothReceiveReadableChanges(t: TestContext) {
    for (const kind of ['review', 'change']) {
      const f = workflowFixture(t);
      f.git('checkout', '--orphan', 'root-review');
      f.git('commit', '-m', 'Root minimal authority');
      f.configure({ reviewEvidence: true });
      const r = f.run('--kind', kind);
      assert.equal(r.status, 0, r.stderr);
      const p = calls(f).at(-1).prompt;
      assert.match(p, /Host review evidence/);
      const evidence = this.review(f);
      assert.match(
        JSON.stringify(evidence),
        kind === 'review' ? /Own sample responsibilities/ : /BOUNDARY_EXPECTED/,
      );
      if (kind === 'change') this.checkpointEvidence(evidence);
    }
  }

  /** The actual review turn receives host comparisons for the accepted pre-freeze specification edits. */
  private checkpointEvidence(evidence: any): void {
    assert.equal(evidence.frozenRegressions.basis, 'frozen-regression-checkpoint');
    assert.ok(evidence.frozenRegressions.files.length > 0);
    for (const file of evidence.frozenRegressions.files) {
      assert.equal(file.status, 'preserved');
      assert.equal(file.currentSha256, file.frozenSha256);
    }
    assert.match(JSON.stringify(evidence.newFiles), /BOUNDARY_EXPECTED/);
    assert.match(evidence.patch, /source\.txt/);
  }

  /** Verifies that revision review evidence excludes paths outside declared read authority. */
  revisionReviewEvidenceExcludesPathsOutsideDeclaredReadAuthority(t: TestContext) {
    const f = workflowFixture(t);
    this.narrowReview(f);
    f.commit();
    writeFileSync(join(f.repo, 'source.txt'), 'SECRET_OUTSIDE_READ_SCOPE');
    writeFileSync(join(f.repo, 'docs/behavior.md'), 'VISIBLE_CHANGE');
    f.commit();
    f.configure({ reviewEvidence: true });
    const r = f.run('--kind', 'review');
    assert.equal(r.status, 0, r.stderr);
    const prompt = calls(f).at(-1).prompt;
    assert.match(prompt, /review.evidence/);
    assert.match(this.review(f).patch, /VISIBLE_CHANGE/);
    assert.doesNotMatch(JSON.stringify(this.review(f)), /SECRET_OUTSIDE_READ_SCOPE/);
  }

  /** Inspects bytes obtained by the controlled model through the canonical evidence tool. */
  private review(f: any): any {
    const captured = JSON.parse(readFileSync(f.calls + '.review', 'utf8'));
    assert.equal(captured.manifest.artifacts[0].id, 'review');
    return captured.review;
  }

  /** Separates the hidden file's owner and uses a finite check that needs no hidden source access. */
  private narrowReview(f: any): void {
    f.component.reads = ['docs'];
    f.component.owns = ['docs', 'tests', 'new.txt'];
    writeFileSync(join(f.repo, 'architecture/components/sample.json'), JSON.stringify(f.component));
    const path = join(f.repo, 'architecture/components/dependency.json');
    const dependency = JSON.parse(readFileSync(path, 'utf8'));
    dependency.owns.push('source.txt');
    writeFileSync(path, JSON.stringify(dependency));
    const operationPath = join(f.repo, 'architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(operationPath, 'utf8'));
    operation.args = ['-e', 'process.exit(0)'];
    writeFileSync(operationPath, JSON.stringify(operation));
  }

  /** Verifies that specification delegates unavailable sandbox checks to the authoritative host. */
  specificationDelegatesUnavailableSandboxChecksToTheAuthoritativeHost(t: TestContext) {
    const f = workflowFixture(t);
    f.configure({ sandboxFeedback: true });
    const r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.outcome, 'ready_for_integration');
    assert.ok(report.commands.some((c: any) => c.exitCode === 1));
    assert.ok(report.regressionCheckpoint.outputIncludes === 'BOUNDARY_EXPECTED');
  }

  /** Verifies that specification exposes both required source changes in the actual turn prompt. */
  specificationExposesBothRequiredSourceChangesInTheActualTurnPrompt(t: TestContext) {
    const f = workflowFixture(t),
      r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const prompt = calls(f).find((c: any) => c.stage === 'specification').prompt;
    assert.match(prompt, /actual edit to at least one.*documentation/);
    assert.match(prompt, /host rejects this checkpoint if either kind of change is missing/);
    assert.match(prompt, /Do not substitute a sandbox shell command/);
    assert.match(prompt, /regression must not be null/);
  }

  /** Verifies that documentation only specification requires real documentation edits through the built cli. */
  documentationOnlySpecificationRequiresRealDocumentationEditsThroughTheBuiltCLI(t: TestContext) {
    const f = workflowFixture(t),
      assignment = join(f.root, 'documentation.json');
    this.documentationAssignment(assignment);
    f.configure({ documentationOnly: true });
    const r = this.runDocumentation(f, assignment);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.deepEqual(
      report.changes.map((c: any) => c.path),
      ['docs/behavior.md'],
    );
    assert.ok(!report.commands.some((c: any) => c.stage === 'red-test'));
    assert.equal(report.status, 'completed');
  }

  /** Runs an explicit documentation assignment through the assembled session with captured native bindings. */
  private runDocumentation(f: any, assignment: string) {
    return spawnSync(
      process.execPath,
      [
        stewardEntry,
        'run',
        'sample',
        '--assignment',
        assignment,
        '--project',
        f.repo,
        '--bindings',
        join(f.root, 'minimal-bindings.json'),
        '--codex-path',
        f.executable,
      ],
      { encoding: 'utf8', env: f.env, timeout: 30 * 60 * 1000 },
    );
  }

  /** Writes a documentation-only assignment so behavior checkpoints must be explicitly skipped. */
  private documentationAssignment(assignment: string): void {
    writeFileSync(
      assignment,
      JSON.stringify({
        schemaVersion: 3,
        kind: 'change',
        changeType: 'documentation',
        objective: 'Update documentation',
        expectedOutcome: 'Updated docs',
        acceptanceCriteria: ['Updated documentation'],
        hostChecks: [],
      }),
    );
  }
}

const suite = new ContextTests();

const calls = (f: any) =>
  readFileSync(f.calls, 'utf8')
    .trim()
    .split('\n')
    .map((line: string) => JSON.parse(line));

test('bound command executes from supplied context with reset PATH and read-only tool visibility', (t: any) =>
  suite.boundCommandExecutesFromSuppliedContextWithResetPATHAndReadOnlyToolVisibility(t));

test('review receives first-parent diff with hash, no unrelated history', (t: any) =>
  suite.reviewReceivesFirstParentDiffWithHashNoUnrelatedHistory(t));

test('root revision review and candidate review both receive readable changes', (t: any) =>
  suite.rootRevisionReviewAndCandidateReviewBothReceiveReadableChanges(t));

test('revision review evidence excludes paths outside declared read authority', (t: any) =>
  suite.revisionReviewEvidenceExcludesPathsOutsideDeclaredReadAuthority(t));

test('specification delegates unavailable sandbox checks to the authoritative host', (t: any) =>
  suite.specificationDelegatesUnavailableSandboxChecksToTheAuthoritativeHost(t));

test('specification exposes both required source changes in the actual turn prompt', (t: any) =>
  suite.specificationExposesBothRequiredSourceChangesInTheActualTurnPrompt(t));

test('documentation-only specification requires real documentation edits through the built CLI', (t: any) =>
  suite.documentationOnlySpecificationRequiresRealDocumentationEditsThroughTheBuiltCLI(t));

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
