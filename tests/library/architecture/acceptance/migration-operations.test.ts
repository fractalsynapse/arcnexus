import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Compares migrated executable semantics rather than treating similar operation names as equivalent. */
class OperationMigrationScenarios {
  /** Identical recipes share one identity while every original reference remains resolvable. */
  async equivalent(): Promise<void> {
    const first = this.operation('first');
    const second = { ...first, id: 'second', purpose: 'Another description' };
    const input = [second, first];
    const original = structuredClone(input);
    const result = await this.migrate(input);
    assert.equal(result.definitions.length, 1);
    assert.deepEqual(result.identities, { first: 'first', second: 'first' });
    assert.deepEqual(input, original);
    const repeated = await this.migrate(result.definitions);
    assert.deepEqual(repeated.definitions, result.definitions);
    assert.deepEqual(repeated.identities, { first: 'first' });
  }

  /** Working directories, output grants, argv and availability remain independent semantic facts. */
  async distinct(): Promise<void> {
    const base = this.operation('base');
    const result = await this.migrate([
      base,
      { ...base, id: 'cwd', cwd: 'nested' },
      { ...base, id: 'output', generatedDirectories: ['dist'] },
      { ...base, id: 'args', args: ['--help'] },
      { ...base, id: 'activity', activities: ['review'] },
    ]);
    assert.equal(result.definitions.length, 5);
  }

  /** Inline probes become shared finite prerequisites without changing their working context. */
  async probes(): Promise<void> {
    const legacy = {
      ...this.operation('check'),
      schemaVersion: 3,
      probes: [{ command: 'node', args: ['--version'] }],
    };
    delete legacy.prerequisites;
    const result = await this.migrate([legacy]);
    const check = result.definitions.find((entry: any) => entry.id === 'check');
    const probe = result.definitions.find((entry: any) => entry.id === check.prerequisites[0]);
    assert.equal(check.probes, undefined);
    assert.equal(probe.schemaVersion, 4);
    assert.deepEqual(probe.args, ['--version']);
    assert.equal(probe.cwd, legacy.cwd);
    assert.deepEqual((await this.migrate(result.definitions)).definitions, result.definitions);
  }

  /** Equal service commands still represent distinct leases and separately targeted HTTP checks. */
  async services(): Promise<void> {
    const result = await this.migrate(this.serviceDefinitions());
    assert.equal(result.definitions.length, 4);
    assert.equal(result.identities['server-b'], 'server-b');
    assert.equal(
      result.definitions.find((entry: any) => entry.id === 'http-b').http.serviceId,
      'server-b',
    );
  }

  /** Captures two independent leases with otherwise identical process and HTTP definitions. */
  private serviceDefinitions(): any[] {
    const server = {
      ...this.operation('server-a'),
      kind: 'service',
      service: {
        port: 0,
        readinessPath: '/',
        expectedStatus: 200,
      },
    };
    const { command: _command, args: _args, ...base } = this.operation('http-a');
    const http = {
      ...base,
      kind: 'http',
      http: {
        serviceId: 'server-a',
        path: '/',
        expectedStatus: 200,
      },
    };
    return [
      server,
      { ...server, id: 'server-b' },
      http,
      { ...http, id: 'http-b', http: { ...http.http, serviceId: 'server-b' } },
    ];
  }

  /** Cycles, missing references and obsolete deadlines produce diagnostics before returning definitions. */
  async invalid(): Promise<void> {
    await assert.rejects(
      this.migrate([
        { ...this.operation('a'), prerequisites: ['b'] },
        { ...this.operation('b'), prerequisites: ['a'] },
      ]),
      /cycle/i,
    );
    await assert.rejects(
      this.migrate([{ ...this.operation('a'), prerequisites: ['missing'] }]),
      /Missing.*missing/,
    );
    await assert.rejects(
      this.migrate([{ ...this.operation('a'), schemaVersion: 3, probes: [], timeoutSeconds: 20 }]),
      /obsolete.*timeoutSeconds/i,
    );
  }

  /** Defines every execution context field explicitly so deduplication cannot supply hidden defaults. */
  private operation(id: string): any {
    return {
      schemaVersion: 4,
      id,
      purpose: 'Check behavior',
      repository: 'sample',
      cwd: '.',
      category: 'unit-test',
      activities: ['testing'],
      kind: 'command',
      command: 'node',
      args: ['check.js'],
      prerequisites: [],
      generatedDirectories: [],
      artifacts: [],
    };
  }

  /** Exercises compiled migration code without relying on source-only imports. */
  private async migrate(definitions: any[]): Promise<any> {
    const path = new URL(
      '../../../../dist/library/architecture/migration-operations.js',
      import.meta.url,
    );
    const { MigrationOperations } = await import(path.href);
    return new MigrationOperations(definitions).convert();
  }
}

const scenarios = new OperationMigrationScenarios();

test('operation migration deduplicates complete equivalent recipes and is idempotent', () =>
  scenarios.equivalent());

test('operation migration preserves differences in execution context and policy', () =>
  scenarios.distinct());

test('operation migration extracts inline probes into referenced prerequisites', () =>
  scenarios.probes());

test('operation migration diagnoses unresolved references cycles and obsolete budgets', () =>
  scenarios.invalid());

test('operation migration preserves distinct managed service leases and HTTP associations', () =>
  scenarios.services());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
