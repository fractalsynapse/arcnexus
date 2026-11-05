import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { specificationFiles } from '../../../../dist/library/assignment/checkpoints.js';
import type { Component } from '../../../../dist/library/architecture/components.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks actionable missing-source evidence without relaxing the existing ownership guard. */
class SpecificationAdmissionScenarios {
  /** Missing documentation and test sources remain unfrozen and return precise correction feedback. */
  missing(t: TestContext, path: string, identity: string): void {
    const component = { schemaVersion: 6, allowedWritePaths: ['docs', 'tests'] } as Component;
    const record = this.workspace(t);
    mkdirSync(dirname(join(record.workspace, path)), { recursive: true });
    writeFileSync(join(record.workspace, path), 'Controlled specification content');
    assert.throws(
      () => specificationFiles(record, component, false, [{ path, kind: 'M' }]),
      (error: any) => {
        assert.equal(error.name, 'SpecificationValidationError');
        assert.equal(error.identity, identity);
        assert.match(error.feedback, /owned/);
        return true;
      },
    );
  }

  /** An owned configuration edit can accompany specification work but cannot supply its evidence. */
  ownedConfiguration(t: TestContext): void {
    const record = this.workspace(t);
    const paths = ['component.yaml', 'intent.md', 'tests/behavior.test.ts'];
    const component = { schemaVersion: 6, allowedWritePaths: paths } as Component;
    mkdirSync(join(record.workspace, 'tests'));
    for (const path of paths) writeFileSync(join(record.workspace, path), path);
    const edits = paths.map((path) => ({ path, kind: 'M' }));
    assert.throws(() => specificationFiles(record, component, false, edits.slice(0, 1)), {
      name: 'SpecificationValidationError',
      identity: 'missing-documentation',
    });
    assert.deepEqual(specificationFiles(record, component, true, edits.slice(0, 2)), []);
    assert.deepEqual(
      specificationFiles(record, component, false, edits).map((test) => test.path),
      ['tests/behavior.test.ts'],
    );
  }

  /** Supplies actual Git path inspection while keeping all fixture effects disposable. */
  private workspace(t: TestContext): RecordData {
    const workspace = mkdtempSync(join(tmpdir(), 'arcnexus-specification-admission-'));
    t.after(() => rmSync(workspace, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q', workspace]);
    return { workspace } as RecordData;
  }

  /** Out-of-scope edits never become an authoring correction that conceals an authority violation. */
  unauthorized(): void {
    const component = { schemaVersion: 6, allowedWritePaths: ['docs', 'tests'] } as Component;
    assert.throws(
      () =>
        specificationFiles({ workspace: '/unused' } as RecordData, component, false, [
          { path: 'foreign/private.ts', kind: 'M' },
        ]),
      (error: any) => {
        assert.notEqual(error.name, 'SpecificationValidationError');
        return true;
      },
    );
  }
}

const scenarios = new SpecificationAdmissionScenarios();

test('missing specification documentation remains correctable without fabricated evidence', (t) =>
  scenarios.missing(t, 'tests/unit/value.test.ts', 'missing-documentation'));

test('missing regression source remains correctable without freezing documentation as tests', (t) =>
  scenarios.missing(t, 'docs/behavior.md', 'missing-regression-source'));

test('specification correction preserves cross-owner source rejection', () =>
  scenarios.unauthorized());

test('owned configuration can accompany but never substitute for specification evidence', (t) =>
  scenarios.ownedConfiguration(t));

registerSuite({
  component: 'assignment',
  level: 'unit',
  tags: ['deterministic', 'specification-admission'],
});
