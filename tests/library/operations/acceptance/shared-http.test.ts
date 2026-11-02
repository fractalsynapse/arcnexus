import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { OperationExecution } from '../../../../dist/library/operations/operation-execution.js';
import {
  normalizeOperation,
  OperationArguments,
} from '../../../../dist/library/operations/operation-definition.js';
import { operationBridge, type Operation } from '../../../../dist/library/operations/operations.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises actual managed HTTP verification under installed source-read-only confinement. */
class SharedHttpScenarios {
  /** Host verification owns a fresh lease, observes HTTP output and verifies cleanup after success or failure. */
  async verification(t: TestContext, expected = 200): Promise<void> {
    const { root, record, check } = this.fixture(t, expected);
    const executor = new OperationExecution(root, record, AbortSignal.timeout(30_000));
    if (expected === 200) assert.equal((await executor.run(check, 'verify')).exitCode, 0);
    else await assert.rejects(executor.run(check, 'verify'), /Command failed/);
    assert.equal(readFileSync(join(record.workspace, 'canary'), 'utf8'), 'original');
    assert.equal(readFileSync(join(record.workspace, 'generated/count'), 'utf8'), 'x');
    const report = JSON.parse(readFileSync(join(root, 'runs/run/report.json'), 'utf8'));
    assert.equal(report.services[0].status, 'stopped');
    assert.equal(report.services[0].endpointClosed, true);
    const invocation = report.operationInvocations.find(
      (entry: any) => entry.operationId === 'check',
    );
    assert.equal(invocation.definitionDigest, check.definitionDigest);
    assert.equal(invocation.result.exitCode, expected === 200 ? 0 : 1);
    assert.match(readFileSync(invocation.result.log, 'utf8'), /captured service/);
    assert.ok(report.operationInvocations.some((entry: any) => entry.operationId === 'server'));
  }

  /** A completed turn closes its lease without cancelling the next turn of the same assignment. */
  async turns(t: TestContext): Promise<void> {
    const { root, record } = this.fixture(t, 200);
    const resolved = record.resolvedAssignment as any;
    resolved.operations = resolved.context[0].operationPlan.agent;
    resolved.executionProfile = {};
    record.stage = 'testing';
    const bridge = operationBridge(root, record, AbortSignal.timeout(30000), () => {});
    try {
      for (let turn = 0; turn < 2; turn++) {
        await bridge.call('services.start', { id: 'server' });
        bridge.disconnect();
        await bridge.close();
      }
    } finally {
      await bridge.close();
    }
    assert.equal(readFileSync(join(record.workspace, 'generated/count'), 'utf8'), 'xx');
    assert.equal((record.services as any[]).length, 2);
    assert.ok((record.services as any[]).every((service) => service.endpointClosed));
  }

  /** An unavailable host-check selection cannot cancel an already authorized pending service start. */
  async rejectedSelection(t: TestContext): Promise<void> {
    const { root, record } = this.fixture(t, 200);
    const resolved = record.resolvedAssignment as any;
    resolved.operations = resolved.context[0].operationPlan.agent.filter(
      (op: Operation) => op.id === 'server',
    );
    resolved.executionProfile = {};
    record.stage = 'testing';
    this.baseline(record);
    const bridge = operationBridge(root, record, AbortSignal.timeout(30_000), () => {});
    const pending = bridge.call('services.start', { id: 'server' });
    void pending.catch(() => {});
    try {
      const rejected = (await bridge.call('operations.run', { id: 'check' })) as any;
      assert.equal(rejected.status, 'rejected');
      assert.deepEqual(rejected.availableOperationIds, ['server']);
      assert.match(rejected.recovery, /operations.list/);
      await pending;
      assert.ok((record.services as any[]).some((service) => service.status === 'ready'));
      assert.ok(
        !(record.operationInvocations as any[]).some((entry) => entry.operationId === 'check'),
      );
    } finally {
      await Promise.allSettled([pending]);
      await bridge.close();
    }
    assert.equal(readFileSync(join(record.workspace, 'canary'), 'utf8'), 'original');
    assert.ok((record.services as any[]).every((service) => service.endpointClosed));
  }

  /** Equivalent unavailable selections are diagnosed without executing or granting the requested capability. */
  async rejectedLoop(t: TestContext): Promise<void> {
    const { root, record } = this.fixture(t, 200);
    const resolved = record.resolvedAssignment as any;
    resolved.operations = [];
    resolved.executionProfile = {};
    record.stage = 'testing';
    this.baseline(record);
    const bridge = operationBridge(root, record, new AbortController().signal, () => {});
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = (await bridge.call('operations.run', { id: 'host-only' })) as any;
        assert.equal(result.status, 'rejected');
        if (attempt === 2) assert.match(result.loopWarning, /Three equivalent/);
      }
      await assert.rejects(bridge.call('operations.run', { id: 'host-only' }), /Loop requires/);
    } finally {
      await bridge.close();
    }
    assert.equal(record.status, 'needs_attention');
    assert.equal((record.operations as unknown[]).length, 0);
  }

  /** Captures a real immutable baseline for repeated-selection progress fingerprints. */
  private baseline(record: RecordData): void {
    const result = spawnSync(
      'git',
      [
        '-C',
        record.workspace,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-qm',
        'Captured operations',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    record.base = spawnSync('git', ['-C', record.workspace, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).stdout.trim();
  }

  /** Rejects cycles through managed-service preparation before any prerequisite side effect. */
  async cycle(t: TestContext): Promise<void> {
    const { root, record, check } = this.fixture(t, 200, true);
    await assert.rejects(
      new OperationExecution(root, record, new AbortController().signal).run(check, 'verify'),
      /cycle/i,
    );
    assert.equal(existsSync(join(record.workspace, 'generated/count')), false);
  }

  /** Captures one server, preparation and HTTP definition against a disposable Git source tree. */
  private fixture(t: TestContext, expected: number, cycle = false) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-shared-http-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const workspace = join(root, 'source');
    mkdirSync(workspace);
    mkdirSync(join(root, 'runs/run'), { recursive: true });
    writeFileSync(join(workspace, 'canary'), 'original');
    writeFileSync(join(workspace, 'server.cjs'), this.server());
    assert.equal(spawnSync('git', ['init', '-q', workspace]).status, 0);
    assert.equal(spawnSync('git', ['-C', workspace, 'add', '.']).status, 0);
    const preparation = this.capture('prepare', {
      kind: 'command',
      command: process.execPath,
      args: ['-e', "require('fs').appendFileSync('generated/count','x')"],
    });
    const server = this.capture('server', {
      kind: 'service',
      command: process.execPath,
      args: ['server.cjs'],
      prerequisites: [cycle ? 'check' : 'prepare'],
      network: true,
      service: { port: 0, readinessPath: '/', expectedStatus: 200 },
    });
    const check = this.capture('check', {
      kind: 'http',
      prerequisites: ['prepare'],
      http: { serviceId: 'server', path: '/', expectedStatus: expected },
    });
    return { root, check, record: this.record(workspace, [preparation, server, check]) };
  }

  /** Binds the real installed sandbox and immutable owner operation plan to host evidence. */
  private record(workspace: string, operations: Operation[]): RecordData {
    const owner = {
      id: 'owner',
      repository: 'sample',
      access: { readPaths: ['.'] },
      allowedWritePaths: ['canary', 'server.cjs'],
      operationPlan: { agent: operations },
    };
    return {
      id: 'run',
      workspace,
      commonDir: join(workspace, '.git'),
      commands: [],
      bindings: { tools: { codex: process.env.ARCNEXUS_TEST_CODEX } },
      resolvedAssignment: { context: [owner], initialization: { catalog: [owner] } },
    } as unknown as RecordData;
  }

  /** Resolves fixed context before any executable definition can enter the service checkpoint. */
  private capture(id: string, definition: object): Operation {
    return new OperationArguments().capture(
      normalizeOperation({
        schemaVersion: 4,
        id,
        purpose: 'Verify service',
        repository: 'sample',
        cwd: '.',
        category: 'integration-test',
        activities: ['testing'],
        generatedDirectories: ['generated'],
        artifacts: [],
        probes: [],
        ...definition,
      } as unknown as Operation),
      { ownerId: 'owner', ownedPaths: ['canary', 'server.cjs'], packageRoot: '.' },
    );
  }

  /** Attempts a maintained-source write before announcing an actual loopback server. */
  private server(): string {
    return (
      "const f=require('fs');try{f.writeFileSync('canary','bad');process.exit(9)}catch(e){if(!['EROFS','EPERM','EACCES'].includes(e.code))throw e;}" +
      "const s=require('http').createServer((q,r)=>r.end('captured service'));" +
      "s.listen(Number(process.env.ARCNEXUS_PORT),process.env.ARCNEXUS_HOST,()=>console.log(JSON.stringify({arcnexusEndpoint:{host:'127.0.0.1',port:s.address().port}})));"
    );
  }
}

const scenarios = new SharedHttpScenarios();

const installed = { skip: !process.env.ARCNEXUS_TEST_CODEX };

test('shared HTTP verification prepares once and closes a confined service lease', installed, (t) =>
  scenarios.verification(t),
);

test(
  'failed shared HTTP verification retains output and closes its service lease',
  installed,
  (t) => scenarios.verification(t, 201),
);

test('shared HTTP preparation rejects implicit service cycles before dispatch', (t) =>
  scenarios.cycle(t));

test('shared service bridge remains usable across assignment turns', installed, (t) =>
  scenarios.turns(t),
);

test('repeated unavailable operation selections require diagnosis', (t) =>
  scenarios.rejectedLoop(t));

test('unavailable operation selection preserves authorized pending work', installed, (t) =>
  scenarios.rejectedSelection(t),
);

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
