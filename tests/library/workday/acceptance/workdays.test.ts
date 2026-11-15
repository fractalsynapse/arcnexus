import { nativeHostTest } from '../../testing/support/general-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { resolveWorkday } from '../../../../dist/library/workday/workday-config.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import { workflowFixture, minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises workdays behavior through observable scenarios. */
class WorkdaysTests {
  /** Verifies that a manifest resolves two disjoint owners offline, creating no state and no calls. */
  manifestResolvesTwoDisjointOwnersWithoutStateOrInference(t: TestContext) {
    const f = fixture(t);
    // The `workday inspect` verb is withheld (#451); the resolution it printed is the public
    // `resolveWorkday()` entry point of this component, so the guarantee is asserted there.
    const x = resolveWorkday(f.path, f.repo);
    assert.equal(x.requester.resolved.componentId, 'sample');
    assert.equal(x.recipient.resolved.componentId, 'dependency');
    assert.ok(x.digest);
    assert.equal(x.base, f.git('rev-parse', 'HEAD'));
    assert.equal(existsSync(f.state), false);
    assert.equal(existsSync(f.calls), false);
  }

  /**
   * Refuses an incoherent edge, overlapping write scopes and an unsupported manifest version, one rule each.
   *
   * Each case names the guard it expects, because the three used to share one assertion on the CLI exit
   * status and a stale authored document made all three refuse for the same unrelated reason. Withholding
   * the `workday inspect` verb (#451) surfaced that by exposing the diagnostics themselves.
   */
  workdayInspectionRejectsOverlapInvalidEdgesAndUnsupportedVersions(t: TestContext) {
    const f = fixture(t);
    for (const [change, refusal] of [
      [
        () => {
          f.manifest.dependency.to = 'sample';
          f.save();
        },
        /Invalid two-owner dependency edge/,
      ],
      [
        () => {
          f.authorDependency(['dependency.txt', 'dependency-docs', 'dependency-tests', 'source.txt']);
        },
        // Overlapping write scope is refused one layer earlier than the workday rule: two owners cannot
        // both claim `source.txt`, so the catalog rejects it before `resolveWorkday` reaches its own
        // scope check (`workday-config.ts:199`), which authored overlap therefore cannot exercise.
        /Overlapping ownership: dependency \/ sample: source\.txt/,
      ],
      [
        () => {
          f.manifest.schemaVersion = 99;
          f.save();
        },
        /Invalid workday: .*schemaVersion/,
      ],
    ] as [() => void, RegExp][]) {
      change();
      assert.throws(() => resolveWorkday(f.path, f.repo), refusal);
      f.reset();
    }
    assert.equal(existsSync(f.state), false);
  }

  /** Verifies that standalone execution retains host checked checkpoint evidence. */
  standaloneExecutionRetainsHostCheckedCheckpointEvidence(t: TestContext) {
    const f = minimalWorkflowFixture(t),
      r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout),
      p = join(f.state, 'runs', report.id, 'checkpoint.json');
    assert.ok(existsSync(p));
    const c = JSON.parse(String(readFileSync(p)));
    assert.equal(c.threadId, 'workflow-thread');
    assert.equal(c.activity, 'finished');
    assert.equal(c.status, 'prepared');
    assert.equal(c.implementationAttempts, 1);
    assert.ok(c.frozenTests.length);
    assert.equal(c.authorityHash, report.resolvedAssignment.digest);
  }
}

const suite = new WorkdaysTests();

/** The two-owner manifest every case starts from, before it is mutated to prove a refusal. */
function validManifest(): any {
  return {
    schemaVersion: 1,
    requester: { component: 'sample', assignment: 'requester.json', refresh: [] },
    recipient: { component: 'dependency', assignment: 'recipient.json', refresh: [] },
    dependency: {
      from: 'sample',
      to: 'dependency',
      contract: 'sample-contract',
      delivery: 'Verified dependency contract',
    },
    acceptance: [],
  };
}

const dependencyOwns = ['dependency.txt', 'dependency-docs', 'dependency-tests'];

/**
 * Authors the dependency leaf, write scope included.
 *
 * Only authored fields belong in this document. `path`, `access` and `allowedWritePaths` are loader
 * derivations and the closed component schema refuses them, so the version of this fixture that carried
 * the derived projection made every refusal case fail with the same `Invalid component` error before any
 * manifest rule was reached — a green scenario that proved nothing.
 */
function dependencyDocument(f: any, owns: string[]): any {
  return {
    ...f.component,
    id: 'dependency',
    parentId: 'package',
    purpose: 'Own dependency behavior',
    owns,
  };
}

/**
 * Commits the dependency leaf so the catalog authority matches the case under test.
 *
 * The commit is skipped when the document already carries these paths: `git commit` exits 1 on an empty
 * change, which is a fixture bookkeeping failure rather than the manifest rule the case is proving.
 */
function authorDependency(f: any, owns: string[]): void {
  const path = join(f.repo, '.arc/architecture/components/dependency.json');
  const document = JSON.stringify(dependencyDocument(f, owns));
  if (existsSync(path) && readFileSync(path, 'utf8') === document) return;
  writeFileSync(path, document);
  f.commit();
}

function defineParticipants(f: any): void {
  authorDependency(f, dependencyOwns);
  const assignment = {
    schemaVersion: 2,
    kind: 'change',
    objective: 'Implement bounded contract',
    expectedOutcome: 'Verified behavior',
    acceptanceCriteria: ['Contract works'],
    hostChecks: [],
  };
  for (const name of ['requester', 'recipient'])
    writeFileSync(join(f.root, name + '.json'), JSON.stringify(assignment));
}

/** Committed fixture carrying a manifest, its file path, and the restorers each refusal case needs. */
function fixture(t: any): any {
  const f = workflowFixture(t);
  defineParticipants(f);
  const manifest = validManifest();
  const path = join(f.root, 'workday.json');
  const save = () => writeFileSync(path, JSON.stringify(manifest));
  save();
  return {
    ...f,
    manifest,
    path,
    save,
    authorDependency: (owns: string[]) => authorDependency(f, owns),
    reset: () => {
      Object.assign(manifest, validManifest());
      authorDependency(f, dependencyOwns);
      save();
    },
  };
}

test('a manifest resolves two disjoint owners offline without state or inference', (t: any) =>
  suite.manifestResolvesTwoDisjointOwnersWithoutStateOrInference(t));

test('workday inspection rejects overlap invalid edges and unsupported versions', (t: any) =>
  suite.workdayInspectionRejectsOverlapInvalidEdgesAndUnsupportedVersions(t));

nativeHostTest('standalone execution retains host-checked checkpoint evidence', (t: any) =>
  suite.standaloneExecutionRetainsHostCheckedCheckpointEvidence(t),
);

registerSuite({
  component: 'workday',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
