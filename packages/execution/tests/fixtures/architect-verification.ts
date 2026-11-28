import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { Agent, type ActivationInput } from '../../../agent/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import type { CheckResult } from '../../src/check.js';
import { LocalMcp } from '../../src/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ProductionCheckFixture } from './production-check.js';

export const audit = 'declared-audit';
export const selection = { component: 'architecture', activity: 'updating' };
const catalog = '.arc/architecture';

/** Supply captured Architect authority and candidate commands over real admission and journal state. */
export class ArchitectVerificationFixture extends ProductionCheckFixture {
  readonly agent = new Agent(this.architecture);
  readonly inputs: ActivationInput[] = [];

  /** Declare one binding as both a model tool and mandatory completion verification. */
  constructor(t: TestContext, native = false) {
    super(t);
    this.update(catalog + '/project.yaml', (value) => { value.architect = selection; });
    this.update(catalog + '/components/architecture.yaml', (value) => {
      value.activities = { updating: {
        role: 'assessor', profile: 'architecture', instructions: ['Assess without approving.'],
        operations: [{ operation: audit, parameters: { entry: 'nested/command.mjs' } }],
        verification: [audit], standards: [],
      } };
    });
    this.update(catalog + '/execution-profiles/architecture.yaml', (value) => {
      value.operationCategories.push('check');
    });
    this.write(catalog + '/operations/' + audit + '.yaml', {
      id: audit, category: 'check', tool: 'check', command: '/usr/bin/node',
      args: [{ parameter: 'entry' }, 'success'], network: false,
      parameters: { entry: { type: 'string', default: 'wrong-default.mjs' } },
    });
    if (native) this.candidateRuntime();
    this.git('add', '.');
    this.git('commit', '-m', 'Capture required Architect completion verification');
  }

  /** Isolate the model response while leaving HostTask activation and completion enforcement real. */
  respond(t: TestContext, kind: 'proposal' | 'no-change', before?: () => Promise<void>) {
    t.mock.method(this.agent, 'activate', async (input: ActivationInput) => {
      this.inputs.push(input);
      await before?.();
      return kind === 'proposal' ? {
        kind, purpose: 'Clarify the baseline', consequences: ['A clearer guide'],
        implementation: [], changes: [{ path: catalog + '/plan-template.md', content: 'Updated guide.\n' }],
      } : {
        kind, summary: 'The accepted baseline remains aligned.',
        evidence: [{ path: 'baseline', quote: 'durable evidence' }],
      };
    });
  }

  /** Retain exact controlled check failures; these characterize caller handling, not native confinement. */
  controlled(t: TestContext, task: Awaited<ReturnType<this['open']>>, status: number) {
    t.mock.method(task, 'check', async (id, _signal, scope) => {
      const log = task.store('controlled-audit.log', 'Uncovered literal path café\nComplete diagnostic.\n');
      const result = { id, status, log, command: '/usr/bin/node',
        args: ['nested/command.mjs', 'success'], cwd: task.worktree!, durationMs: 0 };
      task.note({ check: result, scope });
      return result;
    });
  }

  /** Invoke the declared check over the actual MCP transport with the request builder's binding. */
  async direct(task: Awaited<ReturnType<this['open']>>) {
    const view = this.agent.prepareRequest(task.capture, selection, { worktree: task.worktree! });
    const actions = new ActivationTools(task, selection, {}, new AbortController().signal);
    const server = new LocalMcp(view.request.options.tools,
      (tool, args) => actions.invoke(tool, args), () => {});
    const client = new Client({ name: 'architect-check', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(await server.start())));
      const result = await client.callTool({ name: audit, arguments: { expected: 'pass' } });
      assert(!result.isError, JSON.stringify(result));
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text) as CheckResult;
    } finally {
      await client.close();
      await server.close();
    }
  }

  /** Copy this candidate's compiler output; the audit never uses an unrelated installed Host command. */
  private candidateRuntime() {
    const dist = fileURLToPath(new URL('../../../../', import.meta.url));
    for (const path of ['apps', 'packages'])
      cpSync(join(dist, path), join(this.root, 'runtime', path), { recursive: true });
    this.write('runtime/package.json', { type: 'module' });
    symlinkSync(join(dist, '..', 'node_modules'), join(this.root, 'node_modules'), 'dir');
    this.write('.gitignore', 'node_modules/\n');
    this.update(catalog + '/components/work.yaml', (value) => {
      value.owns.push('runtime', '.gitignore');
    });
    this.update(catalog + '/components/architecture.yaml', (value) => {
      value.activities.updating.operations[0].parameters.entry = 'runtime/apps/cli/src/index.js';
    });
    this.update(catalog + '/operations/' + audit + '.yaml', (value) => {
      value.args = [{ parameter: 'entry' }, 'architecture', 'check-ownership', '--json'];
    });
  }

  /** Change explicit fixture catalog data before its committed authority is captured. */
  private update(path: string, change: (value: any) => void) {
    const value = parse(readFileSync(join(this.root, path), 'utf8'));
    change(value);
    this.write(path, value);
  }

  /** Persist authored fixture data without borrowing the target project's declarations. */
  private write(path: string, value: unknown) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), typeof value === 'string' ? value : stringify(value));
  }
}
