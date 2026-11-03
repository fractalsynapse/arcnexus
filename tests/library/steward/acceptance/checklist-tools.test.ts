import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CodexTools } from '../../../../dist/library/steward/codex-tools.js';
import type { CodexConfiguration } from '../../../../dist/library/steward/codex-configuration.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises checklist rejection and correction through the compiled production MCP connection. */
class ChecklistToolScenarios {
  /** Invalid batches preserve the accepted plan and allow a corrected claim in the same client. */
  async correction(t: TestContext): Promise<void> {
    const f = await this.fixture(t);
    const original = structuredClone(f.record.plan);
    const rejected = await f.call([this.update('first'), this.update('second', [])]);
    assert.equal(rejected.isError, true);
    assert.deepEqual(f.record.plan, original);
    assert.equal(f.tools.signal.aborted, false);
    assert.equal(f.tools.error, undefined);
    const corrected = await f.call([this.update('first'), this.update('second')]);
    assert.notEqual(corrected.isError, true);
    assert.equal((f.record.plan as any).items[1].status, 'completed');
    assert.equal((f.record.plan as any).hostChecks[0].status, 'pending');
    assert.match(readFileSync(join(f.directory, 'timeline.jsonl'), 'utf8'), /tool.rejected/);
  }

  /** Equivalent unchanged rejections require diagnosis and eventually stop dispatch. */
  async loop(t: TestContext): Promise<void> {
    const f = await this.fixture(t);
    for (let n = 0; n < 3; n++) {
      assert.equal((await f.call([this.update('second')])).isError, true);
      assert.equal(f.tools.signal.aborted, false);
    }
    assert.equal((f.record.progress as any).warnings.length, 1);
    assert.equal((await f.call([this.update('second')])).isError, true);
    assert.equal(f.tools.signal.aborted, true);
    assert.equal(f.record.status, 'needs_attention');
  }

  /** Persistence errors remain fatal even when the requested content is otherwise valid. */
  async persistence(t: TestContext): Promise<void> {
    const f = await this.fixture(t);
    writeFileSync(join(f.directory, 'plans'), 'not a directory');
    assert.equal((await f.call([this.update('first')])).isError, true);
    assert.equal(f.tools.signal.aborted, true);
    assert.ok(f.tools.error);
  }

  /** Cancellation is never converted into a correctable content rejection. */
  async cancellation(t: TestContext): Promise<void> {
    const f = await this.fixture(t);
    f.controller.abort(new Error('Cancelled'));
    assert.equal((await f.call([this.update('second')])).isError, true);
    assert.equal(f.tools.signal.aborted, true);
    assert.ok(f.tools.error);
    assert.equal(f.record.progress, undefined);
  }

  /** Builds a complete progress update with explicitly supplied evidence. */
  private update(id: string, evidence = ['observed source contract']) {
    return { id, status: 'completed', evidence, explanation: 'Contract inspected' };
  }

  /** Creates retained host state and opens the actual stdio-to-private-socket MCP adapter. */
  private async fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'checklist-tools-'));
    const directory = join(root, 'runs', 'record');
    mkdirSync(directory, { recursive: true });
    const record = this.record(root);
    const controller = new AbortController();
    const tools = new CodexTools({
      input: { root, record, signal: controller.signal },
    } as unknown as CodexConfiguration);
    const configuration = (await tools.open()) as any;
    const client = new Client({ name: 'checklist-acceptance', version: '1' });
    t.after(async () => {
      await client.close();
      await tools.close();
      rmSync(root, { recursive: true, force: true });
    });
    await client.connect(new StdioClientTransport(configuration.mcp_servers.arcnexus));
    const call = (updates: unknown[]) =>
      client.callTool({ name: 'plan.update', arguments: { updates } });
    return { root, directory, record, controller, tools, call };
  }

  /** Supplies an accepted two-step checklist with pending host acceptance. */
  private record(workspace: string): RecordData {
    return {
      id: 'record',
      workspace,
      status: 'running',
      stage: 'specification',
      commands: [],
      plan: {
        approach: 'Inspect the contract',
        version: 1,
        items: ['first', 'second'].map((id, index) => ({
          id,
          status: 'pending',
          evidence: [],
          explanation: '',
          result: 'Inspect',
          dependencies: index ? ['first'] : [],
        })),
        hostChecks: [{ id: 'final-verification', status: 'pending', evidence: [] }],
      },
    } as unknown as RecordData;
  }
}

const scenarios = new ChecklistToolScenarios();

test('MCP checklist rejection preserves the plan and permits correction', (t) =>
  scenarios.correction(t));

test('MCP checklist failure loops require attention without quotas', (t) => scenarios.loop(t));

test('MCP checklist persistence failures remain fatal', (t) => scenarios.persistence(t));

test('MCP checklist correction cannot swallow cancellation', (t) => scenarios.cancellation(t));

registerSuite({ component: 'steward', level: 'acceptance', tags: ['deterministic'] });
