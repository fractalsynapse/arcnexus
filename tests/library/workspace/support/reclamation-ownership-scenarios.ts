import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TestContext } from 'node:test';
import * as workspace from '../../../../dist/library/workspace/workspace.js';
import { save } from '../../../../dist/library/workspace/state.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Checks continuation ownership and fail-closed workspace reclamation with disposable fixtures. */
export class ReclamationOwnershipScenarios {
  /** Keeps each scenario under one disposable application root. */
  constructor(private readonly t: TestContext) {}

  /** Keeps prepared operation roots alive for a later confined operation and persistence checkpoint. */
  preparedContinuation(): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-prepared-scratch-'));
    const id = randomUUID();
    const scratch = mkdtempSync(join(tmpdir(), 'arcnexus-op-'));
    const configuration = scratch + '-configuration';
    const record = this.record(root, id, scratch, 'running');
    mkdirSync(configuration);
    mkdirSync(join(root, 'runs', id), { recursive: true });
    this.t.after(() => {
      rmSync(root, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
      rmSync(configuration, { recursive: true, force: true });
    });
    save(root, record);
    record.status = 'prepared';
    save(root, record);
    assert.ok(existsSync(scratch));
    assert.ok(existsSync(configuration));
    writeFileSync(join(scratch, 'later-operation'), 'created after preparation');
    record.status = 'running';
    assert.doesNotThrow(() => save(root, record));
    assert.equal(
      readFileSync(join(scratch, 'later-operation'), 'utf8'),
      'created after preparation',
    );
  }

  /** Keeps prepared contributions eligible for continuation rather than startup workspace cleanup. */
  preparedWorkspace(t: TestContext): void {
    const item = this.seedWorkspace(t, 'prepared');
    assert.deepEqual(this.reclaim(item.root), []);
    assert.ok(existsSync(item.workspace));
  }

  /** Unknown persisted workspace ownership cannot authorize removal of an otherwise disposable worktree. */
  unknownWorkspaceOwner(t: TestContext): void {
    const item = this.seedWorkspace(t, 'completed');
    const path = join(item.root, 'runs', item.id, 'report.json');
    const record = JSON.parse(readFileSync(path, 'utf8'));
    delete record.workspaceOwnerIdentity;
    writeFileSync(path, JSON.stringify(record));
    assert.deepEqual(this.reclaim(item.root), []);
    assert.ok(existsSync(item.workspace));
  }

  /** A save by a replacement host refreshes ownership and protects the live workspace. */
  liveHostTakeover(t: TestContext): void {
    const item = this.seedWorkspace(t, 'completed');
    const path = join(item.root, 'runs', item.id, 'report.json');
    const record = JSON.parse(readFileSync(path, 'utf8'));
    save(item.root, record);
    const refreshed = JSON.parse(readFileSync(path, 'utf8')).workspaceOwnerIdentity;
    assert.equal(refreshed.pid, process.pid);
    assert.deepEqual(this.reclaim(item.root), []);
    assert.ok(existsSync(item.workspace));
  }

  /** Builds a valid worktree and persists it from an earlier process. */
  private seedWorkspace(t: TestContext, status: string) {
    const fixture = generalCatalogFixture(t);
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-owner-reclaim-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const id = randomUUID();
    const workspacePath = join(root, 'workspaces', id);
    mkdirSync(join(root, 'runs', id), { recursive: true });
    mkdirSync(join(root, 'workspaces'), { recursive: true });
    const branch = 'codex/run-' + id;
    fixture.git('worktree', 'add', '-b', branch, workspacePath, 'HEAD');
    const record = this.record(root, id, undefined, status);
    Object.assign(record, {
      source: fixture.repo,
      workspace: workspacePath,
      branch,
      base: fixture.git('rev-parse', 'HEAD'),
      commonDir: fixture.git('rev-parse', '--path-format=absolute', '--git-common-dir'),
      environment: {
        schemaVersion: 1 as const,
        prerequisites: [],
        setup: [],
        generatedDirectories: [],
      },
      operationInvocations: [],
    });
    this.persistFromExitedProcess(root, record);
    return { id, root, workspace: workspacePath };
  }

  /** Persists the captured workspace owner from a child that exits before reclamation. */
  private persistFromExitedProcess(root: string, record: object): void {
    const module = pathToFileURL(resolve('dist/library/workspace/state.js')).href;
    const script =
      'const { save } = await import(process.argv[1]); save(process.argv[2], JSON.parse(process.argv[3]));';
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', script, module, root, JSON.stringify(record)],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  }

  /** Creates the minimally persisted record needed by a public state save. */
  private record(root: string, id: string, scratch: string | undefined, status: string) {
    return {
      id,
      source: join(root, 'source'),
      workspace: join(root, 'workspaces', id),
      branch: 'codex/run-' + id,
      base: 'base',
      commonDir: join(root, 'source', '.git'),
      status,
      startedAt: new Date().toISOString(),
      environment: {
        schemaVersion: 4 as const,
        prerequisites: [],
        setup: [],
        generatedDirectories: [],
      },
      commands: [],
      ...(scratch ? { operationTemporaryRoot: scratch } : {}),
      operationInvocations: [],
    };
  }

  /** Runs the same public reclamation capability used during host startup. */
  private reclaim(root: string): string[] {
    return new workspace.WorkspaceReclamation(root).reclaim().workspaces;
  }
}
