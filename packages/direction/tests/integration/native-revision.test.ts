import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type Capture, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { activities, direct, type Feedback, type Milestone, type Plan } from '../../src/index.js';

export const suite = { owner: 'direction', level: 'integration', tags: ['regression'] } as const;

/** Build distinct acceptance identities without embedding real project policy in the fixture. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'direction',
    criteria: [{ id, description: `Retain ${id}` }],
    steps: activities.map((activity) => ({
      activity,
      checklist: [{ id: activity, criteria: [id], expected: activity }],
    })),
  };
}

const activity = {
  role: 'fixture',
  profile: 'fixture',
  instructions: [],
  operations: [],
  standards: [],
};
const catalog: Omit<Capture, 'source'> = {
  project: {
    id: 'fixture',
    remote: 'https://example.com/fixture.git',
    director: { component: 'direction', activity: 'planning' },
    verifier: { component: 'direction', activity: 'review' },
    planTemplate: 'template.md',
    contractRegistry: 'registry.yaml',
  },
  components: {
    direction: {
      id: 'direction',
      purpose: 'Fixture',
      owns: [],
      activities: Object.fromEntries(['planning', ...activities].map((id) => [id, activity])),
    },
  },
  roles: { fixture: { id: 'fixture' } },
  profiles: {
    fixture: {
      id: 'fixture',
      model: 'fixture',
      reasoning: 'low',
      webSearch: 'disabled',
      operationCategories: [],
    },
  },
  operations: {},
  standards: {},
  contracts: [],
};

/** Exercise native Direction and the real shared request builder with an isolated journal. */
class NativeRevision {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-director-revision-'));
  readonly agent = new Agent(new Architecture());
  readonly plan: Plan = {
    focus: { purpose: 'Deliver', objectives: ['Improve'], constraints: ['Retain authority'] },
    milestones: [
      ...Array.from({ length: 200 }, (_, i) => milestone(`completed-${i}`)),
      milestone('pending'),
    ],
  };
  readonly task = this.createTask();
  readonly historicalArtifact = this.task.store(
    'historical-transcript.jsonl',
    'Retained older transcript',
  );
  private closed = false;
  private reviews = 0;
  readonly inputs: { data: TaskContext; rendered: string }[] = [];
  readonly replies: unknown[] = [];

  /** Replace only the external provider; preserve real request rendering and immutable artifacts. */
  constructor(t: TestContext, completed = 200) {
    t.mock.method(this.task, 'close', () => this.close());
    t.after(() => {
      this.close();
      rmSync(this.root, { recursive: true, force: true });
    });
    this.retainHistory(completed);
    t.mock.method(
      this.task,
      'activate',
      async (
        _agent: Agent,
        selection: { component: string; activity: string },
        data: TaskContext,
      ) => {
        const request = this.agent.prepareRequest(this.task.capture, selection, {
          ...data,
          goal: this.task.goal,
          worktree: this.root,
        });
        this.inputs.push({ data, rendered: request.request.input });
        return this.replies.shift();
      },
    );
  }

  /** Seed completed activity positions and retain complete answers and failed observations. */
  private retainHistory(completed: number) {
    this.task.record({ plan: this.plan });
    const cursors = Object.fromEntries(
      this.plan.milestones.slice(0, completed).map(({ id }) => [id, 5]),
    );
    this.task.record({ position: { completed, activities: { ...cursors, pending: 2 } } });
    this.task.note({
      retainedAnswer: 'The complete earlier answer',
      failure: 'Retained failed check',
    });
  }

  /** Supply the committed fixture source without consulting the real repository. */
  private capture(): Capture {
    return {
      ...catalog,
      source: {
        root: this.root,
        remote: catalog.project.remote,
        revision: 'captured',
        paths: [],
        read: () => 'Fixture plan template',
      },
    };
  }

  /** Open the fixture's real journal and native host without production admission. */
  private createTask() {
    const capture = this.capture();
    const journal = new Coordination(this.root).admit(capture.source.remote, 'Fixture goal');
    assert('close' in journal);
    return new HostTask(
      {
        capture,
        common: this.root,
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.root,
      },
      'Fixture goal',
      journal,
    );
  }

  /** Release fixture resources once, including when Workflow already closed the session. */
  private close() {
    if (this.closed) return;
    this.task.journal.close();
    this.closed = true;
  }

  readonly services: WorkflowServices = {
    execution: {
      admit: async () => this.task,
      assemble: async () => ({ digest: `candidate-${this.reviews}`, evidence: [] }),
    },
    direction: {
      plan: async () => assert.fail('Must retain the accepted plan'),
      revise: (session, plan, feedback, signal) =>
        direct(this.agent, session, signal, { plan, feedback }),
    },
    agent: { execute: async () => ({ kind: 'completed', evidence: [] }) },
    verification: {
      assess: async (_session, plan, candidate) =>
        this.reviews++ === 0
          ? {
              kind: 'rejected',
              candidate: candidate.digest,
              findings: [
                {
                  owner: 'direction',
                  criterion: 'pending',
                  reason: 'Repair current finding',
                  evidence: ['review.log'],
                },
              ],
            }
          : {
              kind: 'accepted',
              candidate: candidate.digest,
              criteria: [
                ...new Set(plan.milestones.flatMap(({ criteria }) => criteria.map(({ id }) => id))),
              ],
              evidence: [],
            },
    },
    delivery: {
      integrate: async () => {
        this.assertAcceptance();
        return { kind: 'merged', commit: 'staged', evidence: [] };
      },
    },
  };

  /** Inspect canonical acceptance before Workflow closes its real journal connection. */
  private assertAcceptance() {
    const accepted = this.task.history().findLast((event) => 'plan' in event);
    assert(accepted && 'plan' in accepted);
    assert.deepEqual(accepted.plan.milestones.slice(0, 201), this.plan.milestones);
  }

  /** Invoke the unchanged SDK boundary with a canonical host plan and feedback. */
  revise(feedback: Feedback, initial = false) {
    const plan = initial ? undefined : this.plan;
    return direct(this.agent, this.task, new AbortController().signal, { plan, feedback });
  }

  /** Verify the serialized request is bounded while its immutable references remain complete. */
  assertBounded() {
    const input = this.inputs.at(-1)!;
    assert(!input.rendered.includes('completed-199'));
    assert(!input.rendered.includes(this.historicalArtifact));
    const context = (
      input.data.assignment as {
        revisionContext: { acceptedPlan: string; retainedEvidence: string };
      }
    ).revisionContext;
    assert.deepEqual(JSON.parse(readFileSync(context.acceptedPlan, 'utf8')), this.plan);
    assert.match(readFileSync(context.retainedEvidence, 'utf8'), /complete earlier answer/);
    assert.match(readFileSync(context.retainedEvidence, 'utf8'), /Retained failed check/);
  }
}

test('the actual native request omits completed work and reconstructs its partial pending milestone', async (t) => {
  const fixture = new NativeRevision(t);
  fixture.replies.push({
    kind: 'plan',
    plan: {
      milestones: [{ id: 'pending', steps: fixture.plan.milestones[200]!.steps.slice(2) }],
    },
  });
  const result = await fixture.revise({
    kind: 'answer',
    question: 'Boundary?',
    answer: 'Keep it',
    evidence: [],
  });
  fixture.assertBounded();
  assert.deepEqual(result, { kind: 'plan', plan: fixture.plan });
});

test('initial native repair still requests a complete plan with the exact diagnostic', async (t) => {
  const fixture = new NativeRevision(t);
  fixture.replies.push({ kind: 'plan', plan: fixture.plan });
  await fixture.revise({ kind: 'plan-repair', diagnostic: 'plan.focus: expected object' }, true);
  const input = fixture.inputs[0]!;
  assert.match(input.rendered, /plan.focus: expected object/);
  assert(!input.rendered.includes('pending Director response'));
  assert('focus' in (input.data.assignment as { plan: { plan: object } }).plan.plan);
});

test('the unchanged Workflow repairs a native pending response and retains completed acceptance', async (t) => {
  const fixture = new NativeRevision(t, 201);
  const correction = {
    ...milestone('correction'),
    criteria: fixture.plan.milestones[200]!.criteria,
    steps: fixture.plan.milestones[200]!.steps,
  };
  fixture.replies.push(
    { kind: 'plan', plan: { milestones: [{ ...correction, owner: 42 }] } },
    { kind: 'plan', plan: { milestones: [correction] } },
  );
  const result = await new Workflow(fixture.services).run(
    { directory: fixture.root, goal: fixture.task.goal },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(result.kind, 'merged', JSON.stringify(result));
  assert.equal(fixture.inputs.length, 2);
  assert.match(fixture.inputs[1]!.rendered, /owner: expected string, received number/);
  assert(fixture.inputs.every(({ rendered }) => !rendered.includes('completed-199')));
});

/** Build distinct new correction work with the original engineering acceptance. */
function correctionFor(plan: Plan) {
  return {
    ...milestone('correction'),
    criteria: plan.milestones[200]!.criteria,
    steps: plan.milestones[200]!.steps,
  };
}

test('successive distinct native revision errors return to Direction before delivery', async (t) => {
  const fixture = new NativeRevision(t, 201);
  const correction = correctionFor(fixture.plan);
  fixture.replies.push(
    { kind: 'plan', plan: { milestones: [{ ...correction, owner: 42 }] } },
    { kind: 'plan', plan: { milestones: [{ ...correction, steps: null }] } },
    { kind: 'plan', plan: { milestones: [correction] } },
  );
  const outcome = await new Workflow(fixture.services).run(
    { directory: fixture.root, goal: fixture.task.goal },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'merged', JSON.stringify(outcome));
  assert.equal(fixture.inputs.length, 3);
  assert.match(fixture.inputs[1]!.rendered, /owner: expected string, received number/);
  assert.match(fixture.inputs[2]!.rendered, /steps: expected array, received null/);
});

test('a repeated unchanged native validation error holds without another Director call', async (t) => {
  const fixture = new NativeRevision(t, 201);
  const delivery = t.mock.method(fixture.services.delivery, 'integrate');
  const invalid = { ...correctionFor(fixture.plan), owner: 42 };
  fixture.replies.push(
    ...Array.from({ length: 2 }, () => ({ kind: 'plan', plan: { milestones: [invalid] } })),
  );
  const outcome = await new Workflow(fixture.services).run(
    { directory: fixture.root, goal: fixture.task.goal },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'blocked', JSON.stringify(outcome));
  assert.match(
    'reason' in outcome ? outcome.reason : '',
    /owner: expected string, received number/,
  );
  assert.equal(fixture.inputs.length, 2);
  assert.equal(delivery.mock.callCount(), 0);
  fixture.assertBounded();
});

test('cancellation during a rejected Director reply stops before another repair call', async (t) => {
  const fixture = new NativeRevision(t, 201);
  const controller = new AbortController();
  const invocation = t.mock.method(fixture.task, 'activate', async () => {
    controller.abort();
    return undefined;
  });
  const outcome = await new Workflow(fixture.services).run(
    { directory: fixture.root, goal: fixture.task.goal },
    { progress() {} },
    controller.signal,
  );
  assert.equal(outcome.kind, 'cancelled');
  assert.equal(invocation.mock.callCount(), 1);
});
