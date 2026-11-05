import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { OperationExecution } from '../../../../dist/library/operations/operation-execution.js';
import {
  OperationArguments,
  normalizeOperation,
} from '../../../../dist/library/operations/operation-definition.js';
import type { Operation } from '../../../../dist/library/operations/operations.js';
import { git } from '../../../../dist/library/operations/process.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises preparation reuse through the production supervised operation executor. */
class PreparationExecution {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-preparation-'));

  readonly records: RecordData[] = [];

  /** Captures one finite fixture installer without granting arbitrary source writes. */
  operation(): Operation {
    return new OperationArguments().capture(
      normalizeOperation({
        schemaVersion: 4,
        id: 'install',
        purpose: 'Install fixture dependencies',
        kind: 'command',
        repository: 'project',
        cwd: '.',
        category: 'build',
        activities: [],
        prerequisites: [],
        command: 'node',
        args: ['install.js'],
        generatedDirectories: ['node_modules'],
        artifacts: [],
        dependencyInputs: ['lock.json', 'install.js'],
        network: false,
        probes: [],
      }),
      { ownerId: 'owner', ownedPaths: ['src'], packageRoot: '.' },
    );
  }

  /** Prepares distinct worktrees with identical captured dependency inputs and owner scope. */
  record(id: string, operation: Operation): RecordData {
    const workspace = this.source(id);
    const record = {
      id,
      workspace,
      commonDir: join(this.root, 'git'),
      commands: [],
      executionEnvironment: { id: 'test', mode: 'simulation' },
      bindings: {
        schemaVersion: 1,
        repositories: {},
        tools: { node: process.execPath, codex: process.env.ARCNEXUS_TEST_CODEX! },
      },
      operationCatalog: [
        {
          id: 'owner',
          repository: 'project',
          access: { readPaths: ['.'] },
          allowedWritePaths: ['src'],
          operationPlan: { setup: [operation] },
        },
      ],
    } as unknown as RecordData;
    this.records.push(record);
    return record;
  }

  /** Creates tracked fixture inputs and private record storage before execution. */
  private source(id: string): string {
    const workspace = join(this.root, id);
    mkdirSync(workspace);
    mkdirSync(join(this.root, 'runs', id), { recursive: true });
    mkdirSync(join(this.root, 'git'), { recursive: true });
    git(workspace, 'init', '-q');
    writeFileSync(join(workspace, 'lock.json'), 'original');
    writeFileSync(
      join(workspace, 'install.js'),
      "require('fs').writeFileSync('node_modules/proof','installed');",
    );
    git(workspace, 'add', 'lock.json', 'install.js');
    return workspace;
  }

  /** Reuses one real install, retains its origin, then replaces only the changed-input workspace. */
  async run(): Promise<void> {
    const operation = this.operation();
    const first = this.record('director', operation);
    const second = this.record('worker', operation);
    const signal = new AbortController().signal;
    await new OperationExecution(this.root, first, signal).run(operation, 'setup');
    const reused = await new OperationExecution(this.root, second, signal).run(operation, 'setup');
    assert.equal((first.operationInvocations as unknown[]).length, 1);
    assert.equal(Object.hasOwn(second, 'operationInvocations'), false);
    assert.equal(reused.cwd, first.workspace);
    assert.equal(readFileSync(join(second.workspace, 'node_modules/proof'), 'utf8'), 'installed');
    writeFileSync(join(second.workspace, 'lock.json'), 'updated');
    await new OperationExecution(this.root, second, signal).run(operation, 'setup');
    assert.equal((second.operationInvocations as unknown[]).length, 1);
    assert.equal(readFileSync(join(first.workspace, 'node_modules/proof'), 'utf8'), 'installed');
  }

  /** Removes disposable sources and private operation storage after assertions. */
  close(): void {
    for (const record of this.records) {
      if (typeof record.operationTemporaryRoot !== 'string') continue;
      rmSync(record.operationTemporaryRoot, { recursive: true, force: true });
      rmSync(record.operationTemporaryRoot + '-configuration', { recursive: true, force: true });
    }
    rmSync(this.root, { recursive: true, force: true });
  }
}

test(
  'production operations reuse dependency installation and refresh changed inputs',
  {
    skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed native confinement',
  },
  async () => {
    const scenario = new PreparationExecution();
    try {
      await scenario.run();
    } finally {
      scenario.close();
    }
  },
);

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
