import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, operationTool, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { HostTask, steward } from '../../src/index.js';
import { LocalMcp } from '../../src/mcp.js';
import { inboxIdentity } from '../../src/research.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

const contribution = {
  owner: 'other',
  milestone: 'accepted-owner-work',
  reason: 'Need the other component correction',
  question: 'Keep the complete answer\nincluding its conditions.',
};
const request = { kind: 'supplier' as const, ...contribution };
const selection = { component: 'owner', activity: 'implementation' };
/** Preserve original acceptance while giving a supplier its actual five-Step shape. */
function milestone(id: string, owner: string): Milestone {
  return {
    id,
    owner,
    criteria: [{ id, description: `Complete ${id}` }],
    steps: activities.map((activity) => ({
      activity,
      checklist:
        activity === 'implementation'
          ? [{ id: 'work', criteria: [id], expected: `Complete ${id}` }]
          : [],
      ...(activity === 'implementation' ? {} : { inapplicable: 'Not needed in this fixture' }),
    })),
  };
}

const plan: Plan = {
  focus: {
    purpose: 'Repair supplier links',
    objectives: ['Deliver'],
    constraints: ['Keep owners'],
  },
  milestones: [
    milestone('accepted-owner-work', 'owner'),
    milestone('requester', 'owner'),
    milestone('supplier', 'other'),
  ],
};

const input = {
  milestone: { id: 'requester', step: plan.milestones[1]!.steps[2] },
  assignment: {},
  acceptance: plan.milestones[1]!.criteria,
};

/** Exercise actual MCP, steward repair and retained SQLite state with controlled model replies. */
class SupplierLinkScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-supplier-link-'));
  task: HostTask;
  readonly calls: string[] = [];
  private readonly model = new Agent(new Architecture());
  private readonly signal = new AbortController().signal;
  private workflowOwnsClose = false;

  /** Create accepted owner identities and register cleanup without touching live task state. */
  constructor(private readonly t: TestContext) {
    this.task = new StewardFixture(t, this.root).task;
    this.task.record({ plan });
    Object.assign(this.task.capture.components.other!.activities, {
      implementation: { profile: 'profile', operations: [] },
    });
    t.after(() => {
      if (!this.workflowOwnsClose) this.task.close();
    });
  }

  /** Open the real mapped supplier boundary; a refusal must not become an acknowledged request. */
  async mcp() {
    const actions = new ActivationTools(this.task, selection, input, this.signal);
    const binding = operationTool('request-supplier', 'supplier');
    const host = new LocalMcp(
      [binding],
      (tool, args) => actions.invoke(tool, args),
      () => {},
    );
    const client = new Client({ name: 'supplier-fixture', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
      await this.reject(client, binding.name, actions);
      await this.correct(client, binding.name, actions);
    } finally {
      await client.close();
      await host.close();
    }
  }

  /** Inspect the wire diagnostic and prove refusal did not end the calling activation. */
  private async reject(client: Client, name: string, actions: ActivationTools) {
    const rejected = await client.callTool({ name, arguments: contribution });
    assert(rejected.isError, 'A mismatched accepted link must return a caller error');
    assert.match(JSON.stringify(rejected.content), /accepted-owner-work.*owner.*other/);
    assert(!actions.requestedHandoff);
    assert(!this.task.observations<any>().some(({ projectRequest }) => projectRequest));
  }

  /** Correct the refused link in the same tool session without changing ownership or criteria. */
  private async correct(client: Client, name: string, actions: ActivationTools) {
    const accepted = await client.callTool({
      name,
      arguments: { ...contribution, milestone: 'supplier' },
    });
    assert(!accepted.isError);
    assert.deepEqual(actions.finish({}), { ...request, milestone: 'supplier' });
    assert.equal(
      this.task.observations<any>().filter(({ projectRequest }) => projectRequest).length,
      1,
    );
    assert.deepEqual(this.task.history().findLast((event) => 'plan' in event)?.plan, plan);
  }

  /** Return a mismatched structured reply, then require the exact diagnostic in its local correction. */
  async structured(repeat = false) {
    let calls = 0;
    this.t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => {
        if (++calls === 1) return request;
        assert.match(JSON.stringify(data.assignment), /accepted-owner-work.*owner.*other/);
        return repeat ? request : { ...request, milestone: 'supplier' };
      },
    );
    const result = await steward(
      this.model,
      this.task,
      plan.milestones[1]!,
      'implementation',
      this.signal,
    );
    assert.equal(calls, 2);
    assert.equal(result.kind, repeat ? 'blocked' : 'supplier');
    if (result.kind !== 'supplier') {
      assert.match(result.reason, /accepted-owner-work.*owner.*other/);
      return;
    }
    assert.equal(result.milestone, 'supplier');
    assert.equal(result.question, request.question);
  }

  /** Keep the exact response finding when the same activation resumes after an answered question. */
  async continuation() {
    let calls = 0;
    this.t.mock.method(this.task, 'activate', async (...args: Parameters<HostTask['activate']>) => {
      if (++calls === 1) return request;
      const [, , data, , refresh] = args;
      this.task.note({
        clarification: {
          scope: 'repair-question',
          question: 'Which link?',
          answer: request.question,
        },
      });
      const resumed = await refresh!(data);
      assert.match(
        String((resumed.assignment as Record<string, unknown>).responseRepair),
        /accepted-owner-work.*owner.*other/,
      );
      return { kind: 'completed', edits: [], checks: [] };
    });
    const result = await steward(
      this.model,
      this.task,
      plan.milestones[1]!,
      'implementation',
      this.signal,
    );
    assert.equal(result.kind, 'completed');
    assert.equal(calls, 2);
  }

  /** Retain an acknowledged edit and complete answer before a legacy invalid supplier activation. */
  async retainInvalid(activation = true) {
    const actions = new ActivationTools(this.task, selection, input, this.signal);
    await actions.invoke(
      { name: 'checked-edit', handler: 'edit' },
      {
        path: 'fixture.txt',
        expected: null,
        content: 'Retained checked content\n',
      },
    );
    this.task.note({
      clarification: { scope: 'retained-answer', question: 'Why?', answer: request.question },
    });
    this.task.note({
      projectRequest: { ...request, scope: inboxIdentity(this.task, selection, input) },
    });
    this.task.record({ position: { completed: 1, activities: { requester: 2 } } });
    if (activation)
      this.task.record({
        activation: {
          milestone: 'requester',
          owner: 'owner',
          index: 2,
          step: 'implementation',
          outcome: { ...request, evidence: ['retained-invalid-link'] },
        },
      });
  }

  /** Reopen the real journal under a new attempt without modifying retained observations. */
  restart() {
    this.task.finish({ kind: 'blocked', reason: 'Retained invalid request', evidence: [] });
    const { config, goal } = this.task;
    this.task.close();
    const journal = new Coordination(this.root).admit(config.capture.source.remote, goal);
    assert('close' in journal);
    this.task = new HostTask(config, goal, journal);
    this.task.worktree = this.root;
    this.t.mock.method(this.task, 'cleanup', () => {});
  }

  /** Resume through public Workflow and real steward assignment rather than repairing stored records. */
  async resume() {
    this.t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.resumeReply(data),
    );
    this.workflowOwnsClose = true;
    const result = await new Workflow(this.services).run(
      { directory: this.root, goal: this.task.goal },
      { progress() {} },
      this.signal,
    );
    assert.equal(
      result.kind,
      'merged',
      JSON.stringify({ kind: result.kind, reason: 'reason' in result ? result.reason : undefined }),
    );
    assert.deepEqual(this.calls, ['requester', 'direction', 'supplier', 'requester']);
  }

  /** Deliver the exact retained diagnostic before allowing a corrected supplier handoff. */
  private resumeReply(data: TaskContext) {
    if (!this.corrected) {
      this.corrected = true;
      assert.match(JSON.stringify(data.assignment), /accepted-owner-work.*owner.*other/);
      const actions = new ActivationTools(this.task, selection, data, this.signal);
      assert(!actions.requestedHandoff, 'The invalid retained request must not be reacknowledged');
      return { ...request, milestone: 'supplier' };
    }
    return { kind: 'completed', edits: [], checks: [], answer: request.question };
  }

  private corrected = false;

  private readonly services: WorkflowServices = {
    execution: {
      admit: async () => this.task,
      checkpoint: async (_session, activation) => this.task.record({ activation }),
      assemble: async () => ({ digest: 'candidate', evidence: [] }),
    },
    direction: {
      plan: async () => assert.fail('The accepted plan must survive restart'),
      revise: async (_session, previous, feedback) => {
        this.calls.push('direction');
        assert.equal(feedback.kind, 'supplier');
        assert.equal(feedback.milestone, 'supplier');
        assert.deepEqual(previous, plan);
        return {
          kind: 'plan',
          plan: {
            ...plan,
            milestones: [plan.milestones[0]!, plan.milestones[2]!, plan.milestones[1]!],
          },
        };
      },
    },
    agent: {
      execute: async (session, selected, activity, signal) => {
        this.calls.push(selected.id);
        return steward(this.model, session, selected, activity, signal);
      },
    },
    verification: {
      assess: async () => ({
        kind: 'accepted',
        candidate: 'candidate',
        criteria: plan.milestones.flatMap(({ criteria }) => criteria.map(({ id }) => id)),
        evidence: [],
      }),
    },
    delivery: {
      integrate: async () => {
        this.verifyRetained();
        return { kind: 'merged', commit: 'staging', evidence: [] };
      },
    },
  };

  /** Inspect original retained effects through their journal rather than duplicating evidence bodies. */
  private verifyRetained() {
    assert.equal(
      readFileSync(join(this.root, 'fixture.txt'), 'utf8'),
      'Retained checked content\n',
    );
    const events = this.task.observations<any>();
    assert.equal(events.filter(({ editReceipt }) => editReceipt).length, 1);
    assert.equal(events.filter(({ clarification }) => clarification).length, 1);
    assert.equal(
      events.find(({ clarification }) => clarification)?.clarification.answer,
      request.question,
    );
    assert(events.some(({ projectRequest }) => projectRequest?.milestone === request.milestone));
  }
}

test('local MCP refuses a mismatched supplier link and accepts its caller correction', async (t) => {
  await new SupplierLinkScenario(t).mcp();
});

test('a structured supplier mismatch repairs in the calling steward with the exact diagnostic', async (t) => {
  await new SupplierLinkScenario(t).structured();
});

test('an unchanged invalid supplier reply holds at its caller without inventing progress', async (t) => {
  await new SupplierLinkScenario(t).structured(true);
});

test('supplier repair preserves its exact diagnostic across caller answer continuation', async (t) => {
  await new SupplierLinkScenario(t).continuation();
});

for (const boundary of ['acknowledgment', 'activation'] as const) {
  test(`restart repairs an invalid supplier after ${boundary} before Direction and preserves effects`, async (t) => {
    const scenario = new SupplierLinkScenario(t);
    await scenario.retainInvalid(boundary === 'activation');
    scenario.restart();
    await scenario.resume();
  });
}
