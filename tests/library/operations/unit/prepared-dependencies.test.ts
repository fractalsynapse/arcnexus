import { validateSchema } from '../../../../dist/library/architecture/schema.js';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PreparedDependencies } from '../../../../dist/library/operations/prepared-dependencies.js';
import { SourceConfinement } from '../../../../dist/library/operations/confinement.js';
import { git, type CommandResult } from '../../../../dist/library/operations/process.js';
import type { Operation } from '../../../../dist/library/operations/operations.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises shared installation receipts without substituting them for verification evidence. */
class DependencyScenarios {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-dependencies-'));

  readonly operation = {
    id: 'install',
    kind: 'command',
    schemaVersion: 4,
    repository: 'project',
    cwd: '.',
    command: 'node',
    args: ['install.js'],
    definitionDigest: 'recipe',
    dependencyInputs: ['lock.json'],
    generatedDirectories: ['node_modules'],
    artifacts: [],
    resolvedContext: { ownerId: 'owner' },
  } as unknown as Operation;

  installs = 0;

  /** Creates isolated source and record directories sharing one execution environment. */
  record(id: string): RecordData {
    const workspace = join(this.root, id);
    mkdirSync(workspace);
    mkdirSync(join(this.root, 'runs', id), { recursive: true });
    git(workspace, 'init', '-q');
    writeFileSync(join(workspace, 'lock.json'), 'original');
    git(workspace, 'add', 'lock.json');
    return {
      id,
      workspace,
      commonDir: 'project',
      commands: [],
      executionEnvironment: { id: 'simulation', mode: 'simulation' },
      operationCatalog: [
        {
          id: 'owner',
          repository: 'project',
          access: { readPaths: ['.', 'src/' + id] },
          allowedWritePaths: ['src'],
        },
      ],
    } as unknown as RecordData;
  }

  /** Supplies an observed installation result while counting actual installer executions. */
  async install(record: RecordData): Promise<CommandResult> {
    this.installs++;
    mkdirSync(join(record.workspace, 'node_modules'), { recursive: true });
    writeFileSync(join(record.workspace, 'node_modules/dependency'), 'installed');
    return {
      command: 'node',
      args: ['install.js'],
      cwd: record.workspace,
      startedAt: 'now',
      durationMs: 1,
      exitCode: 0,
      log: 'original-log',
    };
  }

  /** Compiles the packaged strict schema before testing executable dependency configurations. */
  schema(): void {
    const { resolvedContext: _context, definitionDigest: _digest, ...definition } = this.operation;
    const value = {
      ...definition,
      purpose: 'Install dependencies',
      category: 'build',
    };
    assert.equal(validateSchema('operation', value), value);
    assert.throws(
      () => validateSchema('operation', { ...value, dependencyInputs: [] }),
      /Invalid operation/,
    );
    assert.throws(
      () => validateSchema('operation', { ...value, artifacts: ['report.json'] }),
      /Invalid operation/,
    );
    assert.throws(
      () => validateSchema('operation', { ...value, kind: 'service' }),
      /Invalid operation/,
    );
  }

  /** Three workspaces reuse one install; local copies have no writable shared inode. */
  async reuse(): Promise<void> {
    const records = ['director', 'worker', 'reviewer'].map((id) => this.record(id));
    for (const record of records)
      await new PreparedDependencies(this.root, record).run(this.operation, () =>
        this.install(record),
      );
    assert.equal(this.installs, 1);
    writeFileSync(join(records[1]!.workspace, 'node_modules/dependency'), 'local-only');
    assert.equal(
      readFileSync(join(records[0]!.workspace, 'node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(
      readFileSync(join(records[2]!.workspace, 'node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(records[2]!.operationInvocations, undefined);
    assert.deepEqual(PreparedDependencies.outputs(records[2]!), ['node_modules']);
  }

  /** Reclaimed dependency copies are restored from the retained cache without rerunning installation. */
  async restoreRemoved(): Promise<void> {
    const record = this.record('reclaimed');
    const preparation = new PreparedDependencies(this.root, record);
    await preparation.run(this.operation, () => this.install(record));
    rmSync(join(record.workspace, 'node_modules'), { recursive: true });
    await preparation.run(this.operation, () => this.install(record));
    assert.equal(this.installs, 1);
    assert.equal(
      readFileSync(join(record.workspace, 'node_modules/dependency'), 'utf8'),
      'installed',
    );
  }

  /** Changed dependency inputs and environment identity require fresh observed preparation. */
  async invalidation(): Promise<void> {
    const first = this.record('first');
    const second = this.record('second');
    await new PreparedDependencies(this.root, first).run(this.operation, () => this.install(first));
    writeFileSync(join(second.workspace, 'lock.json'), 'changed');
    await new PreparedDependencies(this.root, second).run(this.operation, () =>
      this.install(second),
    );
    const live = this.record('live');
    live.executionEnvironment = { id: 'live', mode: 'live' };
    await new PreparedDependencies(this.root, live).run(this.operation, () => this.install(live));
    assert.equal(this.installs, 3);
  }

  /** An interrupted installer retains uncertainty and cannot be silently replayed elsewhere. */
  async interrupted(): Promise<void> {
    const first = this.record('first');
    await assert.rejects(
      new PreparedDependencies(this.root, first).run(this.operation, async () => {
        throw new Error('lost');
      }),
      /lost/,
    );
    const second = this.record('second');
    await assert.rejects(
      new PreparedDependencies(this.root, second).run(this.operation, () => this.install(second)),
      /incomplete/,
    );
    assert.equal(this.installs, 0);
  }

  /** A recorded failure releases its cache build while preserving failure observations for retry. */
  async failedRetry(): Promise<void> {
    const record = this.record('failed');
    await assert.rejects(
      new PreparedDependencies(this.root, record).run(this.operation, async () => {
        record.operationInvocations = [{ operationId: this.operation.id, status: 'failed' }];
        throw new Error('observed HTTP403');
      }),
      /HTTP403/,
    );
    const next = this.record('retry');
    await new PreparedDependencies(this.root, next).run(this.operation, () => this.install(next));
    assert.equal(this.installs, 1);
    assert.deepEqual(record.operationInvocations, [
      { operationId: this.operation.id, status: 'failed' },
    ]);
  }

  /** Maintained outputs fail before removal and broad output grants cannot make dependencies writable. */
  async protection(): Promise<void> {
    const record = this.record('source');
    mkdirSync(join(record.workspace, 'src'));
    writeFileSync(join(record.workspace, 'src/new-file'), 'keep');
    await assert.rejects(
      new PreparedDependencies(this.root, record).run(
        { ...this.operation, generatedDirectories: ['src'] },
        () => this.install(record),
      ),
      /overlaps/,
    );
    assert.equal(readFileSync(join(record.workspace, 'src/new-file'), 'utf8'), 'keep');
    const policy = new SourceConfinement({
      workspace: record.workspace,
      reads: ['.'],
      outputs: ['node_modules', 'dist'],
      readOnlyOutputs: ['node_modules'],
      temporaryRoot: join(this.root, 'temporary'),
      executable: 'codex',
    });
    assert.equal(policy.filesystem[join(record.workspace, 'node_modules')], 'read');
    assert.equal(policy.filesystem[join(record.workspace, 'dist')], 'write');
  }

  /** Receipt publication bounds settled snapshots while retaining receipts and historical evidence. */
  async boundsSnapshotsAfterReceipt(): Promise<void> {
    const evidence = this.retainedEvidence();
    const first = await this.prepared('first');
    const old = this.snapshot(first);
    const oldReceipt = readFileSync(join(old, 'receipt.json'), 'utf8');
    const middle = this.snapshot(await this.prepared('middle', 'middle'));
    const middleReceipt = readFileSync(join(middle, 'receipt.json'), 'utf8');
    const current = this.snapshot(await this.prepared('current', 'current'));

    assert.equal(
      readFileSync(join(current, 'outputs/node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(
      JSON.parse(readFileSync(join(current, 'receipt.json'), 'utf8')).recordId,
      'current',
    );
    assert.equal(readFileSync(join(old, 'receipt.json'), 'utf8'), oldReceipt);
    assert.equal(readFileSync(join(middle, 'receipt.json'), 'utf8'), middleReceipt);
    for (const [path, bytes] of evidence) assert.equal(readFileSync(path, 'utf8'), bytes);
    assert.equal(
      existsSync(join(old, 'outputs')),
      false,
      'Superseded preparation snapshot payload must be discarded',
    );
    assert.equal(existsSync(join(middle, 'outputs')), false);
  }

  /** A historical receipt without a snapshot requires installation again when its inputs return. */
  async rebuildsDiscardedSnapshot(): Promise<void> {
    await this.prepared('original');
    const newer = this.snapshot(await this.prepared('newer', 'changed'));
    const restored = this.snapshot(await this.prepared('returned'));

    assert.equal(this.installs, 3, 'A discarded preparation snapshot must be rebuilt');
    assert.equal(
      readFileSync(join(restored, 'outputs/node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(
      JSON.parse(readFileSync(join(restored, 'receipt.json'), 'utf8')).recordId,
      'returned',
    );
    assert.equal(existsSync(join(newer, 'outputs')), false);
    assert.equal(existsSync(join(newer, 'receipt.json')), true);
  }

  /** Publishing one operation's receipt leaves a different operation's settled snapshot intact. */
  async preservesOtherOperation(): Promise<void> {
    const other = { ...this.operation, id: 'other-install', definitionDigest: 'other-recipe' };
    const record = await this.prepared('other', 'original', other);
    const directory = this.snapshot(record, other.id);
    const receipt = readFileSync(join(directory, 'receipt.json'), 'utf8');
    const old = this.snapshot(await this.prepared('first'));
    await this.prepared('replacement', 'changed');

    assert.equal(
      readFileSync(join(directory, 'outputs/node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(readFileSync(join(directory, 'receipt.json'), 'utf8'), receipt);
    assert.equal(
      existsSync(join(old, 'outputs')),
      false,
      'Receipt publication must reclaim only its own superseded snapshot',
    );
  }

  /** A paused installer keeps its directory until it can publish its own complete snapshot. */
  async preservesInFlightPreparation(): Promise<void> {
    await this.prepared('previous');
    const active = this.record('in-flight');
    writeFileSync(join(active.workspace, 'lock.json'), 'pending');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = new PreparedDependencies(this.root, active).run(this.operation, async () => {
      const result = await this.install(active);
      await gate;
      return result;
    });
    const inFlight = this.incompleteSnapshot();

    try {
      await this.prepared('settled', 'settled');
      assert.equal(existsSync(inFlight), true);
      assert.equal(existsSync(join(inFlight, 'receipt.json')), false);
    } finally {
      release();
      await running;
    }
    assert.equal(
      readFileSync(join(inFlight, 'outputs/node_modules/dependency'), 'utf8'),
      'installed',
    );
    assert.equal(existsSync(join(inFlight, 'receipt.json')), true);
  }

  /** Runs the public preparation contract with controlled input bytes and an observed installer. */
  private async prepared(
    id: string,
    input = 'original',
    operation = this.operation,
  ): Promise<RecordData> {
    const record = this.record(id);
    writeFileSync(join(record.workspace, 'lock.json'), input);
    await new PreparedDependencies(this.root, record).run(operation, () => this.install(record));
    return record;
  }

  /** Locates a retained snapshot using the published operation identity instead of a guessed key. */
  private snapshot(record: RecordData, operationId = this.operation.id): string {
    const entries = record.preparedDependencies as Array<{ key: string; operationId: string }>;
    const entry = entries.find((item) => item.operationId === operationId);
    assert.ok(entry, 'Preparation must retain its published identity');
    return join(this.root, 'prepared-dependencies', entry.key);
  }

  /** Finds the real incomplete directory created by the public run while its installer is paused. */
  private incompleteSnapshot(): string {
    const root = join(this.root, 'prepared-dependencies');
    const paths = readdirSync(root).map((key) => join(root, key));
    const incomplete = paths.filter((path) => !existsSync(join(path, 'receipt.json')));
    assert.equal(incomplete.length, 1);
    return incomplete[0]!;
  }

  /** Seeds prior durable evidence whose exact bytes must survive later preparation publications. */
  private retainedEvidence(): Array<[string, string]> {
    const directory = join(this.root, 'runs', 'historical');
    mkdirSync(directory, { recursive: true });
    return ['journal.jsonl', 'invocation-original.log', 'report.json'].map((name) => {
      const path = join(directory, name);
      const bytes = 'Retained evidence: ' + name;
      writeFileSync(path, bytes);
      return [path, bytes];
    });
  }

  /** Removes only disposable test resources after all assertions complete. */
  close(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

for (const name of [
  'schema',
  'reuse',
  'restoreRemoved',
  'invalidation',
  'interrupted',
  'failedRetry',
  'protection',
  'boundsSnapshotsAfterReceipt',
  'rebuildsDiscardedSnapshot',
  'preservesOtherOperation',
  'preservesInFlightPreparation',
] as const)
  test('prepared dependencies: ' + name, async () => {
    const scenario = new DependencyScenarios();
    try {
      await scenario[name]();
    } finally {
      scenario.close();
    }
  });

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic'] });
