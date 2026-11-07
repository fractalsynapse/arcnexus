import { validateSchema } from '../../../../dist/library/architecture/schema.js';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { OperationArguments } from '../../../../dist/library/operations/operation-definition.js';
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
  record(id: string, ownerId = 'owner'): RecordData {
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
          id: ownerId,
          repository: 'project',
          access: { readPaths: ['.', 'src/' + id] },
          allowedWritePaths: ['src'],
        },
      ],
    } as unknown as RecordData;
  }

  /** Supplies an observed installation result while counting actual installer executions. */
  async install(record: RecordData, outputs = ['node_modules']): Promise<CommandResult> {
    this.installs++;
    for (const output of outputs) mkdirSync(join(record.workspace, output), { recursive: true });
    writeFileSync(join(record.workspace, 'node_modules/dependency'), 'installed');
    if (outputs.includes('dist')) writeFileSync(join(record.workspace, 'dist/proof'), 'installed');
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
      activities: [],
    };
    assert.equal(validateSchema('operation-v4', value), value);
    assert.throws(
      () => validateSchema('operation-v4', { ...value, dependencyInputs: [] }),
      /Invalid operation/,
    );
    assert.throws(
      () => validateSchema('operation-v4', { ...value, artifacts: ['report.json'] }),
      /Invalid operation/,
    );
    assert.throws(
      () => validateSchema('operation-v4', { ...value, kind: 'service' }),
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

  /** Changed commands, cwd, outputs, network, tool bindings and repository identity invalidate reuse. */
  async executionInputs(): Promise<void> {
    const record = this.record('execution-inputs');
    await new PreparedDependencies(this.root, record).run(this.operation, () =>
      this.install(record),
    );
    const variants = [
      { ...this.operation, command: 'npm' },
      { ...this.operation, cwd: 'nested' },
      { ...this.operation, generatedDirectories: ['node_modules', 'dist'] },
      { ...this.operation, network: true },
    ];
    for (const [index, operation] of variants.entries()) {
      await new PreparedDependencies(this.root, record).run(operation, () =>
        this.install(record, operation.generatedDirectories),
      );
      assert.equal(this.installs, index + 2);
    }
    await this.bindingAndRepositoryIdentity(record, variants.length + 3);
  }

  /** Changed executable bindings and repository identity each require a fresh preparation. */
  private async bindingAndRepositoryIdentity(record: RecordData, expected: number): Promise<void> {
    record.bindings = {
      schemaVersion: 1,
      repositories: {},
      tools: { node: '/alternate-tools/node' },
    };
    await new PreparedDependencies(this.root, record).run(this.operation, () =>
      this.install(record),
    );
    record.commonDir = join(this.root, 'other-repository');
    await new PreparedDependencies(this.root, record).run(this.operation, () =>
      this.install(record),
    );
    assert.equal(this.installs, expected);
  }

  /** Removes stale receipt protection when another operation refreshes shared outputs. */
  async refreshAcrossOperationIds(): Promise<void> {
    const record = this.record('refresh');
    await new PreparedDependencies(this.root, record).run(this.operation, () =>
      this.install(record),
    );
    writeFileSync(join(record.workspace, 'lock.json'), 'changed');
    await new PreparedDependencies(this.root, record).run(
      { ...this.operation, id: 'verify-install' },
      () => this.install(record),
    );
    assert.equal(this.installs, 2);
    assert.deepEqual(
      (record.preparedDependencies as Array<{ operationId: string }>).map(
        (entry) => entry.operationId,
      ),
      ['verify-install'],
    );
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

  /** Reuses equivalent setup and verification preparations across distinct owner contexts. */
  async ownerContexts(): Promise<void> {
    const setup = this.record('setup', 'setup-owner');
    const verification = this.record('verification', 'verification-owner');
    const original = await new PreparedDependencies(this.root, setup).run(
      this.contextual('setup-owner'),
      () => this.install(setup),
    );
    const reused = await new PreparedDependencies(this.root, verification).run(
      this.contextual('verification-owner'),
      () => this.install(verification),
    );
    this.assertReuse(verification, original, reused);
    await this.rejectUnauthorizedContext(verification);
  }

  /** Checks the retained receipt, timeline evidence, and copied dependency contents. */
  private assertReuse(
    verification: RecordData,
    original: CommandResult,
    reused: CommandResult,
  ): void {
    assert.equal(this.installs, 1, 'Unused owner context must reuse the successful preparation');
    assert.deepEqual(reused, original);
    assert.equal(verification.operationInvocations, undefined);
    const [event] = readFileSync(join(this.root, 'runs/verification/timeline.jsonl'), 'utf8')
      .trim()
      .split('\\n')
      .map((line) => JSON.parse(line) as { type: string; payload: Record<string, unknown> });
    assert.equal(event!.type, 'operation.preparation-reused');
    assert.equal(event!.payload.operationId, 'install');
    assert.equal(event!.payload.sourceRecordId, 'setup');
    assert.equal(
      readFileSync(join(verification.workspace, 'node_modules/dependency'), 'utf8'),
      'installed',
    );
  }

  /** Revalidates captured owner authority even when an equivalent receipt exists. */
  private async rejectUnauthorizedContext(verification: RecordData): Promise<void> {
    await assert.rejects(
      new PreparedDependencies(this.root, verification).run(this.contextual('intruder'), () =>
        this.install(verification),
      ),
      /captured owner authority/,
    );
    assert.equal(this.installs, 1);
  }

  /** Context used in argv changes execution semantics and requires another installation. */
  async consumedContext(): Promise<void> {
    const setup = this.record('setup', 'setup-owner');
    const verification = this.record('verification', 'verification-owner');
    for (const [record, ownerId] of [
      [setup, 'setup-owner'],
      [verification, 'verification-owner'],
    ] as const)
      await new PreparedDependencies(this.root, record).run(this.contextual(ownerId, true), () =>
        this.install(record),
      );
    assert.equal(this.installs, 2, 'Consumed owner context must invalidate preparation reuse');
  }

  /** Effective read authority remains part of preparation identity after unused context is removed. */
  async effectiveReads(): Promise<void> {
    const first = this.record('first');
    const second = this.record('second');
    const catalog = second.operationCatalog as Array<{ access: { readPaths: string[] } }>;
    catalog[0]!.access.readPaths = ['lock.json'];
    for (const record of [first, second])
      await new PreparedDependencies(this.root, record).run(this.operation, () =>
        this.install(record),
      );
    assert.equal(this.installs, 2, 'Changed effective reads must invalidate preparation reuse');
  }

  /** Captures realistic differing host metadata while keeping definition and fixed argv identical. */
  private contextual(ownerId: string, consumeOwner = false): Operation {
    return new OperationArguments().capture(
      {
        ...this.operation,
        definitionArguments: [
          'install.js',
          ...(consumeOwner ? [{ context: 'ownerId' as const }] : []),
        ],
      },
      {
        ownerId,
        ownedPaths: [`src/${ownerId}`],
        packageRoot: '.',
        selectedTestFiles: [`.test-build/${ownerId}.test.js`],
        testOutputRoot: '.test-build',
      },
    );
  }

  /** Removes only disposable test resources after all assertions complete. */
  close(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

for (const name of [
  'schema',
  'reuse',
  'ownerContexts',
  'consumedContext',
  'executionInputs',
  'effectiveReads',
  'restoreRemoved',
  'invalidation',
  'refreshAcrossOperationIds',
  'interrupted',
  'failedRetry',
  'protection',
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
