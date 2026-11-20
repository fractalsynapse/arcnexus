import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { git } from '../../src/git.js';
import { HostTask, steward } from '../../src/index.js';
import { LocalMcp } from '../../src/mcp.js';

const remote = 'https://example.com/foreign-handoff.git';
export const diagnostic = 'other.txt(1,1): error TS2345: unfinished foreign consumer migration';
export const answer = '  Foreign consumer migrated.\n\nThe original required checks must pass.  ';
export const question = 'Finish the accepted consumer migration.\nReturn its complete result.';
export const ownedContent = 'Secured caller correction\n';

/** Give both owners explicit accepted criteria and applicable Implementation work. */
function milestone(id: string, owner: string): Milestone {
  return {
    id,
    owner,
    criteria: [
      { id: `${id}-criterion`, description: `Complete ${id} without changing acceptance` },
    ],
    steps: activities.map((activity) => ({
      activity,
      ...(activity === 'implementation'
        ? {
            checklist: [
              { id: 'work', criteria: [`${id}-criterion`], expected: 'Satisfy acceptance' },
            ],
          }
        : { checklist: [], inapplicable: 'Outside the controlled scenario' }),
    })),
  };
}

export const requester = milestone('requester', 'owner');
export const supplier = milestone('accepted-migration', 'other');
export const plan: Plan = {
  focus: {
    purpose: 'Sequence accepted foreign work',
    objectives: ['Pass checks'],
    constraints: ['Keep ownership'],
  },
  milestones: [requester, supplier],
};

/** Exercise production steward, request assembly, MCP, Git checkpoints and SQLite with controlled checks. */
export class ForeignHandoffScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-foreign-handoff-'));
  readonly workspace = join(this.root, 'project');
  readonly storage = join(this.root, 'state');
  readonly architecture = new Architecture();
  readonly signal = new AbortController().signal;
  readonly task: HostTask;
  readonly contexts: TaskContext[] = [];
  readonly requests: ReturnType<Architecture['request']>[] = [];
  readonly checks: Array<{ id: string; status: number; log: string }> = [];
  receipt?: unknown;
  mode: 'initial' | 'acknowledge' | 'handoff' | 'resume' = 'initial';

  /** Capture a committed isolated project and replace only external model and check execution. */
  constructor(t: TestContext) {
    this.prepareSource();
    const capture = this.architecture.capture(this.workspace);
    const journal = new Coordination(this.storage).admit(
      remote,
      'Explicit accepted foreign handoff',
    );
    assert(journal instanceof Journal);
    this.task = new HostTask(
      {
        capture,
        common: join(this.workspace, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      journal.goal,
      journal,
    );
    Object.assign(this.task, { worktree: this.workspace, branch: '7-task', issue: '7' });
    this.task.record({ plan });
    t.mock.method(this.task, 'activate', async (_agent, selection, input) =>
      this.reply(selection, input),
    );
    t.mock.method(this.task, 'check', async (id, _signal, scope) => this.observe(id, scope));
    t.after(() => {
      this.task.journal.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Write complete generic guidance and committed source rather than borrowing live configuration. */
  private prepareSource() {
    mkdirSync(this.workspace);
    git(this.workspace, 'init', '-b', '7-task');
    git(this.workspace, 'config', 'user.name', 'Handoff fixture');
    git(this.workspace, 'config', 'user.email', 'fixture@example.invalid');
    git(this.workspace, 'remote', 'add', 'origin', remote);
    this.write('registry.yaml', { contracts: [] });
    this.write('plan.md', 'Controlled handoff plan');
    this.write('.arc/architecture/project.yaml', {
      id: 'fixture',
      remote,
      contractRegistry: 'registry.yaml',
      planTemplate: 'plan.md',
      director: { component: 'direction', activity: 'planning' },
      verifier: { component: 'verification', activity: 'review' },
    });
    this.writeDefinitions();
    git(this.workspace, 'add', '.');
    git(this.workspace, 'commit', '-m', 'Fixture base');
  }

  /** Declare actual roles, profiles, unique ownership and mapped operations for request assembly. */
  private writeDefinitions() {
    this.write('.arc/architecture/roles/engineer.yaml', {
      id: 'engineer',
      purpose: 'Correct owned work',
    });
    this.write('.arc/architecture/execution-profiles/controlled.yaml', {
      id: 'controlled',
      model: 'controlled',
      reasoning: 'high',
      webSearch: 'disabled',
      operationCategories: ['project'],
    });
    const operations = {
      'checked-edit': 'edit',
      'request-supplier': 'supplier',
      'repository-types': 'check',
    };
    for (const [id, tool] of Object.entries(operations))
      this.write(`.arc/architecture/operations/${id}.yaml`, { id, tool, category: 'project' });
    for (const [id, owns] of Object.entries({
      owner: ['fixture.txt'],
      other: ['other.txt'],
      guidance: ['.arc', 'registry.yaml', 'plan.md'],
    }))
      this.write(`.arc/architecture/components/${id}.yaml`, {
        id,
        owns,
        purpose: `Maintain ${id}`,
        activities: {
          implementation: {
            role: 'engineer',
            profile: 'controlled',
            instructions: ['Use mapped operations'],
            standards: [],
            operations: Object.keys(operations),
            verification: ['repository-types'],
          },
        },
      });
  }

  /** Write fixture data as complete files before source capture. */
  private write(path: string, value: unknown) {
    mkdirSync(dirname(join(this.workspace, path)), { recursive: true });
    writeFileSync(
      join(this.workspace, path),
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }

  /** Record controlled command outcomes honestly; this is not native confinement or live inference. */
  private observe(id: string, scope: Parameters<HostTask['check']>[2]) {
    const status = this.mode === 'resume' ? 0 : 23;
    const log = this.task.store(
      'repository-types.log',
      status ? diagnostic : 'Affected repository check passed\n',
    );
    const check = {
      id,
      status,
      log,
      command: 'controlled-check',
      args: [],
      cwd: this.workspace,
      durationMs: 0,
    };
    this.task.note({ check, scope });
    this.checks.push(check);
    return check;
  }

  /** Build the real request and invoke its advertised operations through the real MCP transport. */
  private async reply(selection: Parameters<HostTask['activate']>[1], input: TaskContext) {
    this.contexts.push(input);
    const request = this.architecture.request(this.task.capture, selection, input);
    this.requests.push(request);
    const actions = new ActivationTools(this.task, selection, input, this.signal);
    const host = new LocalMcp(
      request.request.options.tools,
      (tool, args) => actions.invoke(tool, args),
      () => {},
    );
    const client = new Client({ name: 'controlled-handoff', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
      assert((await client.listTools()).tools.some(({ name }) => name === 'request-supplier'));
      await this.act(client);
      return actions.finish({ kind: 'completed', summary: diagnostic, answer: diagnostic });
    } finally {
      await client.close();
      await host.close();
    }
  }

  /** Secure the caller before failure, explicitly hand off, or acknowledge without requesting work. */
  private async act(client: Client) {
    if (this.mode === 'initial') {
      const result = await client.callTool({
        name: 'checked-edit',
        arguments: { path: 'fixture.txt', expected: null, content: ownedContent },
      });
      assert(!result.isError, JSON.stringify(result));
      this.receipt = this.task
        .observations<any>()
        .findLast(({ editReceipt }) => editReceipt)?.editReceipt;
      assert(this.receipt);
      assert.equal(git(this.workspace, 'show', 'HEAD:fixture.txt'), ownedContent.trimEnd());
    }
    if (this.mode !== 'handoff') return;
    const result = await client.callTool({
      name: 'request-supplier',
      arguments: {
        owner: supplier.owner,
        milestone: supplier.id,
        reason: `Required repository-types needs ${supplier.criteria[0]!.id}`,
        question,
      },
    });
    assert(!result.isError, JSON.stringify(result));
  }

  /** Activate the same original criterion and activity through the public steward entry. */
  run() {
    return steward(
      new Agent(this.architecture),
      this.task,
      requester,
      'implementation',
      this.signal,
    );
  }

  /** Apply the accepted supplier's checked contribution and record its complete Workflow return shape. */
  async supply() {
    const request = {
      kind: 'supplier' as const,
      requester: requester.id,
      owner: supplier.owner,
      milestone: supplier.id,
      reason: `Required repository-types needs ${supplier.criteria[0]!.id}`,
      question,
      evidence: [],
    };
    this.task.record({
      plan: { ...plan, milestones: [supplier, requester] },
      supplier: { milestone: supplier.id, request },
    });
    const actions = new ActivationTools(
      this.task,
      { component: 'other', activity: 'implementation' },
      { milestone: { id: supplier.id }, acceptance: supplier.criteria },
      this.signal,
    );
    await actions.invoke(
      { name: 'checked-edit', handler: 'edit' },
      { path: 'other.txt', expected: null, content: 'Migrated foreign consumer\n' },
    );
    const evidence = [this.task.store('supplier-result.md', answer)];
    this.task.record({
      activation: {
        milestone: supplier.id,
        owner: supplier.owner,
        step: 'implementation',
        index: 2,
        outcome: { kind: 'completed', answer, evidence },
      },
    });
    return evidence;
  }

  /** Check exact retained receipts, source bytes and accepted identities after either caller route. */
  assertRetained() {
    const receipts = this.task
      .observations<any>()
      .flatMap(({ editReceipt }) => (editReceipt ? [editReceipt] : []));
    assert.deepEqual(
      receipts.filter(({ path }) => path === 'fixture.txt'),
      [this.receipt],
    );
    assert.equal(readFileSync(join(this.workspace, 'fixture.txt'), 'utf8'), ownedContent);
    assert.deepEqual(
      this.task
        .history()
        .findLast((event) => 'plan' in event)
        ?.plan?.milestones.find(({ id }) => id === requester.id),
      requester,
    );
    assert.deepEqual(this.contexts.at(-1)!.acceptance, requester.criteria);
    assert.equal(
      this.task.pendingCheck({ owner: 'owner', activity: 'implementation' })?.expected,
      this.mode === 'resume' ? undefined : 'pass',
    );
  }
}
