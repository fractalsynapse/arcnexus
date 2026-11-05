import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEditBridge } from '../../../../dist/library/assignment/checked-edit-bridge.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { SessionState } from '../../../../dist/library/assignment/session-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises proposed suite discovery rules through the bound edit transaction service. */
class NewSuiteEdits {
  readonly workspace: string;

  readonly bridge: CheckedEditBridge;

  /** Creates isolated owned source and captured test policy without invoking a model. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'new-suite-edits-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    this.workspace = join(root, 'source');
    mkdirSync(join(this.workspace, 'owned'), { recursive: true });
    writeFileSync(join(this.workspace, 'owned/intent.md'), 'before');
    this.bridge = new CheckedEditBridge(this.state(root));
  }

  /** Captures the immutable owner and workflow boundary used by the production bridge. */
  private state(root: string): SessionState {
    const resolved = { digest: 'captured-authority' };
    return {
      options: {
        record: {
          workspace: this.workspace,
          id: 'run',
          stage: 'specification',
          resolvedAssignment: resolved,
        },
      },
      dir: join(root, 'evidence'),
      resolved,
      scope: ['owned', 'tests/assignment'],
      assignment: { kind: 'change' },
      frozen: [],
      component: {
        schemaVersion: 6,
        id: 'assignment',
        testProfile: 'node',
        repositoryRoot: '.',
        allowedWritePaths: ['owned', 'tests/assignment'],
        fileClassification: [],
      },
      journal: () => {},
      safe: () => {},
    } as unknown as SessionState;
  }

  /** Invalid registrations cannot partly apply companion documentation, and valid retries remain usable. */
  invalid(): void {
    const path = 'tests/assignment/acceptance/added.test.ts';
    for (const content of [
      "registerSuite(import.meta.url, { owner: 'assignment', level: 'acceptance' });",
      "registerSuite({ component: 'other', level: 'acceptance' });",
      "registerSuite({ component: 'assignment', level: 'unit' });",
      "registerSuite({ component: 'assignment', level: 'acceptance', tags: [dynamic] });",
      '// registration omitted',
    ]) {
      const result = this.bridge.call('source.edit', this.request(path, content)) as any;
      assert.equal(result.status, 'rejected');
      assert.match(result.error, /Invalid test suite edit/);
      assert.equal(readFileSync(join(this.workspace, 'owned/intent.md'), 'utf8'), 'before');
      assert.equal(existsSync(join(this.workspace, path)), false);
    }
    const content =
      "registerSuite({ component: 'assignment', level: 'acceptance', tags: ['regression'] });";
    const result = this.bridge.call('source.edit', this.request(path, content)) as any;
    assert.equal(result.status, 'committed');
    assert.equal(readFileSync(join(this.workspace, path), 'utf8'), content);
  }

  /** Rejects a test-looking file outside the captured package test root before creating it. */
  unsupportedSource(): void {
    const path = 'owned/acceptance/added.test.ts';
    const content = "registerSuite({ component: 'assignment', level: 'acceptance' });";
    const result = this.bridge.call('source.edit', this.request(path, content)) as any;
    assert.equal(result.status, 'rejected');
    assert.match(result.error, /Unsupported test source root/);
    assert.equal(existsSync(join(this.workspace, path)), false);
    assert.equal(readFileSync(join(this.workspace, 'owned/intent.md'), 'utf8'), 'before');
  }

  /** Support files follow normal discovery exclusions and do not need suite registration. */
  support(): void {
    const request = this.request(
      'tests/assignment/support/helper.test.ts',
      'export const helper = 1;',
    );
    assert.equal((this.bridge.call('source.edit', request) as any).status, 'committed');
  }

  /** Keeps one existing-file precondition beside each proposed suite creation. */
  private request(path: string, content: string) {
    return {
      id: 'new-suite',
      changes: [
        {
          path: 'owned/intent.md',
          operation: 'update',
          expectedSha256: digest('before'),
          content: 'after',
        },
        { path, operation: 'create', expectedSha256: null, content },
      ],
    };
  }
}

test('new suite metadata is rejected atomically and valid corrected creation succeeds', (t) =>
  new NewSuiteEdits(t).invalid());

test('support files remain outside suite registration requirements', (t) =>
  new NewSuiteEdits(t).support());

test('new suites must use the captured package test root', (t) =>
  new NewSuiteEdits(t).unsupportedSource());

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
