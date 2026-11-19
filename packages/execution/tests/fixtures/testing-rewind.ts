import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type AgentInspection,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { HostTask, steward } from '../../src/index.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from './steward.js';

export const rewindMilestone: Milestone = {
  id: 'original',
  owner: 'owner',
  criteria: [{ id: 'fixed', description: 'Implement the behavior' }],
  steps: activities.map((activity) => ({ activity, checklist: [] })),
};
const tool: AgentInspection['request']['options']['tools'][number] = {
  name: 'owner-tests',
  handler: 'check',
  description: 'Fixture check',
  inputSchema: {
    type: 'object',
    properties: { expected: { type: 'string', enum: ['pass', 'fail'] } },
    required: ['expected'],
    additionalProperties: false,
  },
};

/** Exercise caller expectation repair through real MCP, journals and the public Steward entry point. */
export class TestingRewindFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-testing-rewind-'));
  readonly scope = { owner: 'owner', activity: 'testing' as const };
  readonly client = new Client({ name: 'rewind-fixture', version: '1' });
  task: HostTask;
  red: string;
  green = '';
  status = 0;
  interrupted = false;
  private host?: LocalMcp;

  /** Retain explicit generic fixture authority; no live result is simulated as qualification. */
  constructor(
    private readonly t: TestContext,
    completed = true,
    redStatus = 37,
  ) {
    this.task = new StewardFixture(t, this.root).task;
    this.configureAuthority();
    this.task.note({ baseRevision: 'authority' });
    this.task.record({
      plan: {
        focus: { purpose: 'Fixture', objectives: [], constraints: [] },
        milestones: [rewindMilestone],
      },
    });
    this.red = this.observation('testing', 'fail', redStatus).log;
    if (completed) this.completeImplementation();
    this.mockCheck();
    t.after(() => this.close());
  }

  /** Declare only the generic fixture's single captured operation and activity. */
  private configureAuthority() {
    Object.assign(this.task.capture, {
      source: { ...this.task.capture.source, revision: 'authority' },
      components: {
        owner: {
          id: 'owner',
          owns: ['fixture.txt'],
          activities: { testing: { profile: 'profile', operations: ['owner-tests'] } },
        },
      },
      operations: {
        'owner-tests': { id: 'owner-tests', command: 'fixture', args: [], network: false },
      },
    });
  }

  /** Close transports before releasing the actual project writer and disposable fixture storage. */
  private async close() {
    await this.client.close();
    await this.host?.close();
    this.task.close();
  }

  /** Record genuine controlled red before completed Testing and Implementation, then a documentation rewind. */
  private completeImplementation() {
    for (const [index, step] of ['testing', 'implementation'].entries()) {
      const log =
        step === 'testing'
          ? this.red
          : (this.green = this.observation('implementation', 'pass', 0).log);
      this.task.record({
        activation: {
          milestone: 'original',
          owner: 'owner',
          index: index + 1,
          step: step as 'testing' | 'implementation',
          outcome: { kind: 'completed', evidence: [log] },
        },
      });
    }
    this.task.record({ position: { completed: 0, activities: { original: 3 } } });
    this.task.record({
      position: { completed: 0, activities: { original: 0 } },
      repair: {
        milestone: 'original',
        activity: 'documentation',
        reason: 'Correct outdated documentation',
        evidence: [],
      },
    });
    this.task.record({ position: { completed: 0, activities: { original: 1 } } });
  }

  /** Return real wire responses from the same captured handler used by native activations. */
  async connect() {
    const actions = new ActivationTools(
      this.task,
      { component: 'owner', activity: 'testing' },
      { milestone: { id: 'original' } },
      new AbortController().signal,
    );
    this.host = new LocalMcp(
      [tool],
      (binding, args) => actions.invoke(binding, args),
      () => {},
    );
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
  }

  /** Keep refusals on the wire so tests can distinguish them from actual executed observations. */
  call(expected: 'pass' | 'fail') {
    return this.client.callTool({ name: 'owner-tests', arguments: { expected } });
  }

  /** Inspect exactly the public Steward's current context without invoking a provider. */
  async context() {
    let assignment: any;
    this.t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, input: TaskContext) => {
        assignment = input.assignment;
        return { kind: 'completed', edits: [], checks: [] };
      },
    );
    await steward(
      new Agent(new Architecture()),
      this.task,
      rewindMilestone,
      'testing',
      new AbortController().signal,
    );
    return assignment;
  }

  /** Reopen the actual retained task journal after interruption, without editing its records. */
  async restart() {
    await this.client.close();
    await this.host?.close();
    const { config, goal } = this.task;
    this.task.finish({ kind: 'blocked', reason: 'Controlled interruption', evidence: [] });
    this.task.close();
    const journal = new Coordination(this.root).admit(config.capture.source.remote, goal);
    assert('close' in journal);
    this.task = new HostTask(config, goal, journal);
    this.task.worktree = this.root;
    this.mockCheck();
  }

  /** Preserve each controlled result separately, including the erroneous request's actual passing result. */
  observation(activity: 'testing' | 'implementation', expected: 'pass' | 'fail', status: number) {
    const log = this.task.store(
      'fixture-check.log',
      status ? 'not ok 1 - original regression' : 'passed',
    );
    const check = {
      id: 'owner-tests',
      command: 'fixture',
      args: [],
      cwd: this.root,
      status,
      log,
      durationMs: 1,
    };
    this.task.note({ check, scope: { owner: 'owner', activity, expected } });
    return check;
  }

  /** Model command outcomes only; MCP, expectation admission and durable recovery stay real. */
  private mockCheck() {
    this.t.mock.method(
      this.task,
      'check',
      async (_id: string, _signal: AbortSignal, scope?: { expected?: 'pass' | 'fail' }) => {
        if (this.interrupted) throw new Error('Controlled interruption before the recheck');
        return this.observation('testing', scope!.expected!, this.status);
      },
    );
  }
}
