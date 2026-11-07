import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { EvidencePages, ExecutionEvidence } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Captures real stored assembly observations through the canonical role-independent evidence path. */
class AssemblyInputScenario {
  /** A director can inspect exact failing combined output without a new capability or caller retrieval. */
  async run(t: TestContext, legacyCommand = true): Promise<void> {
    const f = this.fixture(t, legacyCommand);
    const pages = new EvidencePages('direction.evidence');
    ExecutionEvidence.pin(
      f.root,
      f.run.id,
      pages,
      new ExecutionEvidence(f.root, f.store).capture(f.run.id),
    );
    const execution = await this.json(pages, 'execution');
    assert.equal(execution.assemblies.length, 1);
    const assembly = execution.assemblies[0];
    const data = await this.json(pages, assembly.data.artifact);
    assert.deepEqual(data.findings, ['Missing behavior']);
    const record = await this.json(pages, assembly.record.artifact);
    const observations = await this.json(pages, record.observations.artifact);
    assert.equal(observations.hostCommands.length, 1);
    const command = observations.hostCommands[0];
    assert.equal(command.invocationStatus, 'failed');
    assert.equal(command.exitCode, 1);
    const output = await pages.call('direction.evidence', { artifact: command.output.artifact });
    assert.equal((output as any).content, 'precise combined failure\n');
    const path = join(f.root, 'runs', f.record.id, 'report.json');
    writeFileSync(path, JSON.stringify({ ...f.record, executionRunId: randomUUID() }));
    const foreign = new ExecutionEvidence(f.root, f.store).capture(f.run.id).assemblies[0]!;
    assert.equal((foreign.record as any).evidenceUnavailable, true);
  }

  /** Reads only advertised artifact names from the same paged interface supplied to models. */
  private async json(pages: EvidencePages, artifact: string): Promise<any> {
    return JSON.parse(((await pages.call('direction.evidence', { artifact })) as any).content);
  }

  /** Creates an isolated coordination store and removes all retained fixture evidence after inspection. */
  private storage(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-assembly-evidence-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    return { root, store };
  }

  /** Retains one failed assembled check with real log bytes and authoritative run references. */
  private fixture(t: TestContext, legacyCommand: boolean) {
    const { root, store } = this.storage(t);
    const run = store.createRun('task', ['owner'], 'Fix the combined failure');
    const item = store.enqueue(run.id, 'owner', 'Contribute behavior');
    const id = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    const log = join(directory, 'check.log');
    writeFileSync(log, 'precise combined failure\n');
    const result = { command: 'node', args: ['check'], exitCode: 1, durationMs: 1, log };
    const record = {
      id,
      executionRunId: run.id,
      activationRole: 'publication-checks',
      status: 'failed',
      assemblyAssignments: [{ id: item.id, owner: item.owner }],
      assemblyBase: 'baseline',
      assemblyFindings: ['Missing behavior'],
      commands: legacyCommand ? [result] : [],
      operationInvocations: [
        { id: 'failed-build', operationId: 'build', status: 'failed', purpose: 'setup', result },
      ],
    };
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
    store.updateRun(run.id, 'running', { lastAssembly: { recordId: id } });
    return { root, store, run, record };
  }
}

test('canonical execution evidence exposes combined check failures and rejects foreign records', (t) =>
  new AssemblyInputScenario().run(t));

test('canonical execution evidence exposes failed prerequisites absent from checkpoint commands', (t) =>
  new AssemblyInputScenario().run(t, false));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic'] });
