import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';
import * as workspace from '../../../../dist/library/workspace/workspace.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { SourceConfinement } from '../../../../dist/library/operations/confinement.js';

/** Exercises record transitions and abandoned scratch against real disposable files and process owners. */
export class OperationScratchScenarios {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-scratch-state-'));

  readonly temporary = mkdtempSync(join(tmpdir(), 'arcnexus-op-'));

  readonly id = randomUUID();

  readonly directory = join(this.root, 'runs', this.id);

  readonly record: RecordData;

  /** Keeps all scenario resources isolated from application storage and arranges unconditional disposal. */
  constructor(t: TestContext) {
    this.record = this.input();
    t.after(() => {
      rmSync(this.root, { recursive: true, force: true });
      rmSync(this.temporary, { recursive: true, force: true });
      rmSync(this.temporary + '-configuration', { recursive: true, force: true });
    });
    mkdirSync(this.directory, { recursive: true });
    mkdirSync(this.record.workspace, { recursive: true });
    mkdirSync(this.temporary + '-configuration');
    writeFileSync(join(this.temporary, 'scratch'), 'disposable');
    writeFileSync(join(this.temporary + '-configuration', 'config'), 'private configuration');
    writeFileSync(join(this.record.workspace, 'source.txt'), 'retained engineering material');
  }

  /** Uses the public record shape without manufacturing a private reclamation receipt or owner identity. */
  private input(): RecordData {
    return {
      id: this.id,
      source: join(this.root, 'source'),
      workspace: join(this.root, 'workspaces', this.id),
      branch: 'codex/run-' + this.id,
      base: 'base',
      commonDir: join(this.root, 'source', '.git'),
      status: 'running',
      startedAt: new Date().toISOString(),
      environment: { schemaVersion: 4, prerequisites: [], setup: [], generatedDirectories: [] },
      commands: [],
      operationTemporaryRoot: this.temporary,
      operationInvocations: [{ id: 'operation', status: 'completed' }],
    };
  }

  /** Requires the terminal transition itself to reclaim both disposable roots, independently of a later sweep. */
  terminal(status: string): void {
    save(this.root, this.record);
    this.record.status = status;
    save(this.root, this.record);
    this.assertScratch(false, 'terminal record operation temporary root must be removed');
    save(this.root, this.record);
    this.assertScratch(false, 'repeated terminal save must remain safe');
  }

  /** Repeated running checkpoints retain scratch and the read-only configuration sibling. */
  running(): void {
    save(this.root, this.record);
    save(this.root, this.record);
    this.assertScratch(true, 'running record must retain operation scratch');
  }

  /** A terminal record cannot discard scratch before its operation has reported completion. */
  activeOperation(): void {
    save(this.root, this.record);
    this.record.status = 'completed';
    this.record.operationInvocations = [{ id: 'operation', status: 'running' }];
    save(this.root, this.record);
    this.assertScratch(true, 'unsettled operation must retain operation scratch');
    this.record.operationInvocations = [{ id: 'operation', status: 'completed' }];
    save(this.root, this.record);
    this.assertScratch(false, 'settled terminal operation scratch must be removed');
  }

  /** Keeps authored run artifacts byte-identical while removing the terminal record's disposable roots. */
  evidence(): void {
    const files = this.evidenceFiles();
    save(this.root, this.record);
    this.record.status = 'completed';
    save(this.root, this.record);
    for (const file of files) assert.equal(readFileSync(file, 'utf8'), 'retained:' + file);
    assert.equal(
      JSON.parse(readFileSync(join(this.directory, 'report.json'), 'utf8')).status,
      'completed',
    );
    assert.equal(
      readFileSync(join(this.record.workspace, 'source.txt'), 'utf8'),
      'retained engineering material',
    );
    this.assertScratch(false, 'evidence retention must not pin disposable operation scratch');
  }

  /** Proves absence through an exited recorded owner and preserves retained evidence on repeated startup passes. */
  abandoned(): void {
    const files = [...this.evidenceFiles(), ...this.preparationFiles()];
    this.saveFromExitedProcess(this.root, this.record);
    const report = join(this.directory, 'report.json');
    const stored = JSON.parse(readFileSync(report, 'utf8'));
    assert.notEqual(stored.operationScratchIdentity.ownerPid, process.pid);
    assert.match(stored.operationScratchIdentity.ownerStart, /^\d+$/);
    const before = new Map([...files, report].map((path) => [path, readFileSync(path)]));
    assert.deepEqual(this.reclaim().scratch, [this.id]);
    this.assertScratch(false, 'abandoned operation scratch must be reclaimed');
    for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes);
    assert.ok(existsSync(join(this.record.workspace, 'source.txt')));
    this.reclaim();
    for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes);
  }

  /** A live process protects its resources even when the stored record appears terminal. */
  liveOwner(): void {
    save(this.root, this.record);
    const path = join(this.directory, 'report.json');
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...stored, status: 'completed' }));
    this.reclaim();
    this.assertScratch(true, 'live process owner must protect operation scratch');
    assert.ok(existsSync(join(this.record.workspace, 'source.txt')));
  }

  /** Retains both roots when a persisted owner field is missing, malformed or protected as PID 1. */
  ownerIdentity(field: 'ownerPid' | 'ownerStart', value: unknown): void {
    const stored = this.terminalRecord();
    if (value === undefined) delete stored.operationScratchIdentity[field];
    else stored.operationScratchIdentity[field] = value;
    const path = join(this.directory, 'report.json');
    writeFileSync(path, JSON.stringify(stored));
    const before = readFileSync(path);
    assert.deepEqual(this.reclaim().scratch, []);
    this.assertScratch(true, 'uncertain recorded process ownership must preserve scratch');
    assert.deepEqual(readFileSync(path), before);
  }

  /** Simulates an unreadable process identity while the kernel still confirms that its process exists. */
  unreadableOwner(t: TestContext): void {
    writeFileSync(join(this.directory, 'report.json'), JSON.stringify(this.terminalRecord()));
    const original = fs.readFileSync;
    let denied = 0;
    const mocked = t.mock.method(fs, 'readFileSync', (path: any, ...options: any[]) => {
      if (path === '/proc/' + process.pid + '/stat') {
        denied++;
        throw Object.assign(new Error('Process identity unavailable'), { code: 'EACCES' });
      }
      return Reflect.apply(original, fs, [path, ...options]);
    });
    syncBuiltinESMExports();
    try {
      assert.deepEqual(this.reclaim().scratch, []);
      assert.ok(denied > 0, 'reclamation must attempt to read the recorded process identity');
      this.assertScratch(true, 'unreadable process identity must preserve scratch');
    } finally {
      mocked.mock.restore();
      syncBuiltinESMExports();
    }
  }

  /** An exited owner alone cannot override resource identity, invocation or service shutdown guards. */
  startupGuard(guard: 'resource' | 'invocation' | 'service'): void {
    this.saveFromExitedProcess(this.root, this.record);
    const path = join(this.directory, 'report.json');
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    stored.status = 'completed';
    if (guard === 'resource') stored.operationScratchIdentity.temporary.inode += 1;
    if (guard === 'invocation') stored.operationInvocations[0].status = 'running';
    if (guard === 'service') {
      const directory = join(this.directory, 'services');
      mkdirSync(directory);
      writeFileSync(
        join(directory, 'service.json'),
        JSON.stringify({ runId: this.id, status: 'running' }),
      );
    }
    writeFileSync(path, JSON.stringify(stored));
    assert.deepEqual(this.reclaim().scratch, []);
    this.assertScratch(true, guard + ' guard must preserve abandoned scratch');
  }

  /** Startup retains the private-home redirect and read-only configuration for a live recorded owner. */
  confinementRedirect(t: TestContext): void {
    const fixture = generalCatalogFixture(t);
    this.record.workspace = fixture.repo;
    const adapter = new SourceConfinement({
      workspace: fixture.repo,
      reads: ['.'],
      outputs: [],
      temporaryRoot: this.temporary,
      executable: process.execPath,
    });
    const environment = adapter.environment({ HOME: '/caller-home', CODEX_HOME: '/caller-config' });
    assert.equal(environment.HOME, this.temporary);
    assert.equal(environment.TMPDIR, this.temporary);
    assert.equal(environment.CODEX_HOME, this.temporary + '-configuration');
    assert.equal(adapter.filesystem[this.temporary], 'write');
    assert.equal(adapter.filesystem[this.temporary + '-configuration'], 'read');
    const support = join(this.temporary + '-configuration', 'node-stdio.mjs');
    const before = readFileSync(support);
    writeFileSync(join(this.directory, 'report.json'), JSON.stringify(this.terminalRecord()));
    assert.deepEqual(this.reclaim().scratch, []);
    this.assertScratch(true, 'live owner must preserve private-home resources');
    assert.deepEqual(
      adapter.environment({ HOME: '/caller-home', CODEX_HOME: '/caller-config' }),
      environment,
    );
    assert.deepEqual(readFileSync(support), before);
  }

  /** Captures valid resource ownership before marking only the persisted lifecycle as terminal. */
  private terminalRecord(): any {
    save(this.root, this.record);
    const stored = JSON.parse(readFileSync(join(this.directory, 'report.json'), 'utf8'));
    stored.status = 'completed';
    return stored;
  }

  /** Reclaims an abandoned clean worktree through the existing guarded cleanup path and retains its report. */
  eligibleWorkspace(t: TestContext): void {
    const item = this.seedWorkspace(t);
    const result = this.reclaimWorkspaces(item.root);
    assert.deepEqual(result, [item.id]);
    assert.equal(existsSync(item.workspace), false);
    assert.ok(existsSync(item.source));
    assert.ok(existsSync(join(item.root, 'runs', item.id, 'report.json')));
  }

  /** Creates an owned Git worktree and records it from a process that then exits. */
  private seedWorkspace(t: TestContext) {
    const fixture = generalCatalogFixture(t);
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-workspace-reclaim-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const id = randomUUID();
    const workspacePath = join(root, 'workspaces', id);
    mkdirSync(join(root, 'runs', id), { recursive: true });
    mkdirSync(join(root, 'workspaces'), { recursive: true });
    const branch = 'codex/run-' + id;
    fixture.git('worktree', 'add', '-b', branch, workspacePath, 'HEAD');
    const record = {
      ...this.input(),
      id,
      source: fixture.repo,
      workspace: workspacePath,
      branch,
      base: fixture.git('rev-parse', 'HEAD'),
      commonDir: fixture.git('rev-parse', '--path-format=absolute', '--git-common-dir'),
      status: 'completed',
      environment: { schemaVersion: 1, prerequisites: [], setup: [], generatedDirectories: [] },
      operationInvocations: [],
    };
    this.saveFromExitedProcess(root, record);
    return { id, root, workspace: workspacePath, source: fixture.repo };
  }

  /** Exercises the public sweep without returning its scratch-only result fields. */
  private reclaimWorkspaces(root: string): string[] {
    const result = new workspace.WorkspaceReclamation(root).reclaim();
    return result.workspaces;
  }

  /** Uses state.save so persisted process ownership reflects a real exited process. */
  private saveFromExitedProcess(root: string, record: object): void {
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

  /** A path string without captured ownership is not authority to delete historical resources. */
  unidentified(): void {
    writeFileSync(
      join(this.directory, 'report.json'),
      JSON.stringify({ ...this.record, status: 'completed' }),
    );
    this.reclaim();
    this.assertScratch(true, 'unidentified scratch must be preserved');
    assert.ok(existsSync(join(this.record.workspace, 'source.txt')));
  }

  /** Exercises the public startup path and exposes its actual removals to scenario assertions. */
  private reclaim(): { scratch: string[]; workspaces: string[] } {
    return new workspace.WorkspaceReclamation(this.root).reclaim();
  }

  /** Seeds an explicitly referenced preparation snapshot and receipt outside disposable scratch. */
  private preparationFiles(): string[] {
    const key = 'in-force-preparation';
    const result = {
      command: process.execPath,
      args: [],
      cwd: this.record.workspace,
      startedAt: this.record.startedAt,
      durationMs: 0,
      exitCode: 0,
      log: join(this.directory, 'operation.log'),
    };
    const entry = {
      key,
      operationId: 'setup',
      recordId: this.id,
      outputs: ['node_modules'],
      result,
    };
    this.record.preparedDependencies = [entry];
    const directory = join(this.root, 'prepared-dependencies', key);
    const files = [
      join(directory, 'receipt.json'),
      join(directory, 'outputs', 'node_modules', 'dependency'),
      join(this.record.workspace, 'node_modules', 'dependency'),
    ];
    for (const path of files) mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(files[0]!, JSON.stringify(entry));
    for (const path of files.slice(1)) writeFileSync(path, 'retained preparation snapshot');
    return files;
  }

  /** Seeds representative retained journal, invocation and report locations outside disposable scratch. */
  private evidenceFiles(): string[] {
    const files = [
      join(this.directory, 'events.jsonl'),
      join(this.directory, 'operation.log'),
      join(this.directory, 'invocation-operation.log'),
      join(this.directory, 'report.md'),
      join(this.root, 'private', 'steward', 'activation', 'events.jsonl'),
      join(this.root, 'projects', 'project', 'reports', 'run.md'),
    ];
    for (const file of files) {
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, 'retained:' + file);
    }
    return files;
  }

  /** Checks both filesystem resources so deleting only one sibling cannot satisfy the regression. */
  private assertScratch(expected: boolean, message: string): void {
    assert.equal(existsSync(this.temporary), expected, message);
    assert.equal(
      existsSync(this.temporary + '-configuration'),
      expected,
      message + ': configuration sibling',
    );
  }
}
