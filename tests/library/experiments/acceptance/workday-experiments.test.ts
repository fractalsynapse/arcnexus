import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { test } from 'node:test';

/** Exercises workday experiments behavior through observable scenarios. */
class WorkdayExperimentsTests {
  /** Verifies that real validator owner receives declared build and regression operations. */
  realValidatorOwnerReceivesDeclaredBuildAndRegressionOperations() {
    const r = spawnSync(
      process.execPath,
      [
        cli,
        'inspect',
        'guidance-validation',
        'Implement bounded validator behavior',
        '--project',
        process.cwd(),
        '--json',
      ],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(r.status, 0, String(r.error ?? r.stderr));
    assert.deepEqual(
      JSON.parse(r.stdout)
        .operations.map((o: any) => o.id)
        .sort(),
      ['comment-issue', 'component-format', 'component-lint', 'component-tests', 'guidance-build'],
    );
  }

  /** Verifies that guidance inspection preserves checked skill ownership without direct write grants. */
  guidanceInspectionPreservesCheckedSkillOwnership(t: TestContext) {
    const assignment = this.guidanceAssignment(t);
    const r = spawnSync(
      process.execPath,
      [
        cli,
        'inspect',
        'agent-guidance',
        '--assignment',
        assignment,
        '--project',
        process.cwd(),
        '--json',
      ],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(r.status, 0, String(r.error ?? r.stderr));
    const owner = JSON.parse(r.stdout).context.find((c: any) => c.id === 'agent-guidance');
    assert.ok(owner.allowedWritePaths.includes('.agents/skills'));
    // Ownership is the only write authority: `access` carries derived reads and nothing else, so a
    // second grant cannot drift from what the component declares.
    assert.deepEqual(Object.keys(owner.access), ['readPaths']);
  }

  /** Declares documentation intent explicitly so the preview does not invent behavioral regression authority. */
  private guidanceAssignment(t: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-guidance-inspection-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'assignment.json');
    writeFileSync(
      path,
      JSON.stringify({
        schemaVersion: 3,
        kind: 'change',
        changeType: 'documentation',
        objective: 'Maintain skill metadata',
        expectedOutcome: 'Coherent skill metadata',
        acceptanceCriteria: ['Preserve declared skill ownership'],
        hostChecks: [],
      }),
    );
    return path;
  }
}

const suite = new WorkdayExperimentsTests();

const cli = resolve('dist/cli.js');

test('real validator owner receives declared build and regression operations', () =>
  suite.realValidatorOwnerReceivesDeclaredBuildAndRegressionOperations());

test('guidance inspection preserves checked skill ownership without direct write grants', (t) =>
  suite.guidanceInspectionPreservesCheckedSkillOwnership(t));

registerSuite({ component: 'experiments', level: 'acceptance', tags: ['deterministic'] });
