import assert from 'node:assert/strict';
import { WorkspaceCliFixture } from '../../testing/support/workspace-cli-fixture.js';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ComponentFixture } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises shared setup operations through actual workspace preparation and installed confinement. */
class SharedPreparationScenarios {
  private readonly workspaces = new WeakMap<ComponentFixture, WorkspaceCliFixture>();

  /** Uses captured Node identity even when the caller PATH contains an unrelated inaccessible executable. */
  boundRuntime(t: TestContext): void {
    const f = this.fixture(t);
    const tools = f.root + '-tools';
    mkdirSync(tools);
    t.after(() => rmSync(tools, { recursive: true, force: true }));
    writeFileSync(join(tools, 'node'), '#!/bin/sh\nexit 97\n', { mode: 0o755 });
    this.workspaces.get(f)!.env.PATH = [tools, process.env.PATH ?? ''].join(delimiter);
    const { result, report } = this.execute(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(report.workspace, 'package/generated/proof'), 'utf8'), 'sample');
    assert.equal(report.bindings.tools.node, process.execPath);
  }

  /** Keeps real child IPC usable when durable evidence lives below a long application state path. */
  ipc(t: TestContext): void {
    const f = this.fixture(t);
    f.put(
      'package/src/prepare.cjs',
      "const f=require('fs'),p=require('path');const d=f.mkdtempSync(p.join(require('os').tmpdir(),'ipc-'));const sock=p.join(d,'host.sock');const s=require('net').createServer();s.listen(sock,()=>{f.statSync(sock);s.close(()=>{f.writeFileSync('package/generated/proof','ipc');f.rmSync(d,{recursive:true});});});",
    );
    f.put('.arc/architecture/operations/prepare.json', { ...this.operation(), network: true });
    f.commit();
    const { result, report } = this.execute(f);
    assert.equal(
      result.status,
      0,
      result.stderr + readFileSync(report.operationInvocations.at(-1).result.log, 'utf8'),
    );
    assert.equal(readFileSync(join(report.workspace, 'package/generated/proof'), 'utf8'), 'ipc');
    assert.ok(report.operationTemporaryRoot);
    t.after(() => rmSync(report.operationTemporaryRoot, { recursive: true, force: true }));
    t.after(() =>
      rmSync(report.operationTemporaryRoot + '-configuration', { recursive: true, force: true }),
    );
  }

  /** Resolves setup automatically, writes generated evidence, and preserves maintained source. */
  prepare(t: TestContext, local = false): void {
    const f = this.fixture(t, local);
    const { result, report } = this.execute(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(report.workspace, 'package/generated/proof'), 'utf8'), 'sample');
    assert.equal(
      readFileSync(join(report.workspace, 'package/src/value.ts'), 'utf8'),
      'export const value = 1;',
    );
    assert.equal(report.operationInvocations.length, 1);
    assert.equal(report.operationInvocations[0].purpose, 'setup');
    assert.equal(report.operationInvocations[0].operationId, 'prepare');
    const cleanup = this.workspaces.get(f)!.cleanup(report.id);
    assert.equal(cleanup.status, 0, cleanup.stderr);
  }

  /** Identical inherited setup is executed once even when several owners are eligible. */
  deduplicates(t: TestContext): void {
    const f = this.fixture(t);
    f.put(
      '.arc/architecture/components/second.json',
      f.component('second', 'library', {
        parentId: 'package',
        owns: ['second'],
      }),
    );
    f.put('.arc/architecture/operations/prepare.json', {
      ...this.operation(),
      args: ['package/src/prepare.cjs', 'shared'],
    });
    f.commit();
    const { result, report } = this.execute(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.operationInvocations.length, 1);
    assert.equal(readFileSync(join(report.workspace, 'package/generated/proof'), 'utf8'), 'shared');
  }

  /** Setup scripts cannot mutate maintained files before any after-the-fact scope inspection. */
  denies(t: TestContext): void {
    const f = this.fixture(t);
    f.put(
      'package/src/prepare.cjs',
      "require('fs').writeFileSync('package/src/value.ts','unauthorized');",
    );
    f.commit();
    const { result, report } = this.execute(f);
    assert.equal(result.status, 1);
    assert.equal(
      readFileSync(join(report.workspace, 'package/src/value.ts'), 'utf8'),
      'export const value = 1;',
    );
    assert.match(
      readFileSync(report.operationInvocations[0].result.log, 'utf8'),
      /EROFS|EACCES|EPERM/,
    );
  }

  /** Obsolete execution budgets are rejected before any setup operation can run. */
  budget(t: TestContext): void {
    const f = this.fixture(t);
    f.put('.arc/architecture/execution-profiles/luna.json', {
      schemaVersion: 3,
      id: 'luna',
      model: 'configured-model',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['unit-test'],
      maxTurns: 1,
    });
    f.commit();
    const { result } = this.execute(f);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Remove obsolete work budget maxTurns/);
  }

  /** Uses private fixture evidence and returns the persisted report even when setup fails. */
  private execute(f: ComponentFixture) {
    const result = this.workspaces.get(f)!.prepare();
    const report = result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
    return { result, report };
  }

  /** Registers valid initial authority before individual scenarios introduce their tested faults. */
  private application(f: ComponentFixture, t: TestContext): void {
    const root = f.root + '-application',
      state = join(root, 'state');
    t.after(() => rmSync(root, { recursive: true, force: true }));
    this.workspaces.set(
      f,
      new WorkspaceCliFixture(
        {
          root,
          repo: f.root,
          state,
          env: { ...process.env, ARCNEXUS_STATE_DIR: state },
        },
        join(f.root, '.git/bindings.json'),
      ),
    );
  }

  /** Captures a minimal package with one shared setup definition and no environment commands. */
  private fixture(t: TestContext, local = false): ComponentFixture {
    const f = new ComponentFixture(t);
    if (!local) f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    f.put('.arc/architecture/environment.json', {
      schemaVersion: local ? 5 : 4,
      workspace: {
        primary: local
          ? { id: 'sample' }
          : { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
    this.components(f);
    this.executionDefaults(f);
    f.put('package/.gitignore', 'generated/\n');
    f.put(
      'package/src/prepare.cjs',
      "require('fs').writeFileSync('package/generated/proof',process.argv[2]);",
    );
    f.put('.arc/architecture/operations/prepare.json', this.operation());
    f.put('.git/bindings.json', {
      schemaVersion: 1,
      repositories: {},
      tools: { node: process.execPath, codex: process.env.ARCNEXUS_TEST_CODEX! },
    });
    f.commit();
    this.application(f, t);
    return f;
  }

  /** Supplies explicit director/reviewer authority required by production package preparation. */
  private executionDefaults(f: ComponentFixture): void {
    const path = '.arc/architecture/components/platform.json';
    const platform = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, {
      ...platform,
      director: { component: 'maintenance', profile: 'luna' },
      reviewerProfile: 'luna',
      defaultPackage: 'package',
    });
  }

  /** Gives package inheritance, source ownership and shared definitions distinct declarations. */
  private components(f: ComponentFixture): void {
    f.put(
      '.arc/architecture/components/package.json',
      f.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        operations: { prepare: ['setup'] },
      }),
    );
    f.put(
      '.arc/architecture/components/operations.json',
      f.component('operations', 'library', {
        parentId: 'maintenance-package',
        owns: [],
      }),
    );
    f.put(
      '.arc/architecture/components/unrelated-filename.json',
      f.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests', '.gitignore'],
      }),
    );
  }

  /** Declares generated output and command context in one executable definition. */
  private operation() {
    return {
      schemaVersion: 4,
      id: 'prepare',
      purpose: 'Prepare outputs',
      repository: 'sample',
      kind: 'command',
      command: 'node',
      args: ['package/src/prepare.cjs', { context: 'ownerId' }],
      cwd: '.',
      category: 'unit-test',
      generatedDirectories: ['package/generated'],
      artifacts: ['package/generated/proof'],
    };
  }
}

const scenarios = new SharedPreparationScenarios();

test(
  'shared preparation uses captured Node instead of caller PATH shadowing',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires native-host qualification' },
  (t) => scenarios.boundRuntime(t),
);

test(
  'shared operation temporary storage supports real private IPC',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.ipc(t),
);

test(
  'minimal package prepares through captured shared operations',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.prepare(t),
);

test(
  'shared preparation deduplicates inherited resolved operations',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.deduplicates(t),
);

test(
  'shared preparation denies setup-script source mutation',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.denies(t),
);

test(
  'local-only package prepares and cleans up without an invented upstream',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.prepare(t, true),
);

test('shared preparation rejects obsolete profile budgets', (t) => scenarios.budget(t));

registerSuite({
  component: 'architecture',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
