import { bindLintTool } from '../support/lint-tool.js';
import { registerSuite } from '../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../library/testing/support/general-fixture.js';
import {
  minimalOperationFixture as operationFixture,
  configureAgentOperation,
} from '../../library/testing/support/operations-fixture.js';

/** Exercises lint operation behavior through observable scenarios. */
class LintOperationTests {
  /** Verifies that declared lint feedback reaches the steward through the production bridge. */
  feedback(t: TestContext): void {
    const fixture = operationFixture(t);
    this.configure(fixture);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.operations.map((op: any) => op.exitCode),
      [1, 0],
      report.operations.map((op: any) => readFileSync(op.log, 'utf8')).join('\n'),
    );
    assert.match(
      readFileSync(join(fixture.root, 'operations.jsonl'), 'utf8'),
      /no-restricted-syntax/,
    );
  }

  /** Declares a real ESLint operation whose failure changes when the candidate is repaired. */
  private configure(fixture: any): void {
    bindLintTool(fixture);
    configureAgentOperation(fixture, [
      '--no-config-lookup',
      '--ext',
      '.txt',
      '--rule',
      'no-restricted-syntax: [error, "Identifier[name=before]"]',
      'source.txt',
    ]);
    const path = join(fixture.repo, 'architecture/operations/agent-probe.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    operation.category = 'lint';
    operation.command = 'lint-tool';
    writeFileSync(path, JSON.stringify(operation));
    const profilePath = join(fixture.repo, 'architecture/execution-profiles/luna.yaml');
    const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
    profile.operationCategories = ['unit-test', 'lint'];
    writeFileSync(profilePath, JSON.stringify(profile));
    fixture.commit();
  }
}

const suite = new LintOperationTests();

test('declared lint feedback reaches the steward through the production bridge', (t) =>
  suite.feedback(t));

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
