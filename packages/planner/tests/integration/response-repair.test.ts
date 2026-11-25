import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { AgentActivityHold, InvalidAgentResponse, type Agent } from '../../../agent/src/index.js';
import type { Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { Planner } from '../../src/index.js';

export const suite = { owner: 'planner', level: 'integration', tags: ['planning'] } as const;
const valid = {
  summary: 'No change warranted',
  ratings: [],
  comparison: ['No gap'],
  changes: [],
  links: [],
  sources: [],
};

/** Drive the public Planner against a real journal and scripted malformed replies. */
class PlannerRepairScenario {
  readonly requests: TaskContext[] = [];
  readonly task: HostTask;

  /** Retain one source and approval scope without creating an unrelated delivery workspace. */
  constructor(t: TestContext, replies: readonly unknown[]) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-planner-repair-'));
    const capture = {
      source: { root, revision: 'fixture', remote: 'https://example.com/planner.git', paths: [] },
      project: {},
    } as unknown as Capture;
    const journal = new Coordination(root).admit(capture.source.remote, 'Assess goals');
    assert('close' in journal);
    this.task = new HostTask(
      { capture, common: root, storage: root, executable: '', base: 'staging', fresh: true },
      'Assess goals',
      journal,
    );
    this.task.branch = 'existing';
    t.after(() => {
      this.task.close();
      rmSync(root, { recursive: true, force: true });
    });
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => {
        const reply = replies[this.requests.length];
        this.requests.push(data);
        if (reply instanceof Error) throw reply;
        return reply;
      },
    );
  }

  /** Exercise generation, validation and ordinary no-change reporting through the public capability. */
  run() {
    return new Planner({} as Agent).propose(
      this.task,
      'exploration',
      () => {},
      new AbortController().signal,
    );
  }
}

test('Planner repairs successive native and proposal findings within the original mapping', async (t) => {
  const scenario = new PlannerRepairScenario(t, [
    new InvalidAgentResponse('Malformed native JSON'),
    { ...valid, comparison: [] },
    valid,
  ]);
  const outcome = await scenario.run();
  assert('kind' in outcome);
  assert.equal(outcome.kind, 'planned');
  assert.equal(scenario.requests.length, 3);
  assert.match(JSON.stringify(scenario.requests[1]), /Malformed native JSON/);
  assert.match(JSON.stringify(scenario.requests[2]), /Compare goal gaps/);
  for (const request of scenario.requests.slice(1)) {
    const { diagnostic: _diagnostic, ...assignment } = request.assignment as Record<
      string,
      unknown
    >;
    const { diagnostic: _initial, ...original } = scenario.requests[0]!.assignment as Record<
      string,
      unknown
    >;
    assert.deepEqual(assignment, original);
    assert.deepEqual(request.milestone, scenario.requests[0]!.milestone);
  }
});

test('Planner holds an unchanged finding despite new transcript filenames', async (t) => {
  const scenario = new PlannerRepairScenario(
    t,
    ['first.log', 'second.log'].map(
      (path) =>
        new InvalidAgentResponse(`Malformed JSON at ${path}`, { identity: 'Malformed JSON' }),
    ),
  );
  await assert.rejects(scenario.run(), AgentActivityHold);
  assert.equal(scenario.requests.length, 2);
});

test('Planner records the exact goal draft only after the retained approval', async (t) => {
  const { task, draft } = draftFixture(t);
  const planner = new Planner({} as Agent);
  const signal = new AbortController().signal;
  await assert.rejects(
    planner.proposeDraft(task, { ...draft, revision: 'stale' }, () => {}, signal),
    /revision is stale/,
  );
  task.ask = async (question) => {
    assert.match(question, /-Previous outcome/);
    assert.match(question, /\+Updated outcome/);
    return undefined;
  };
  const propose = () => planner.proposeDraft(task, draft, () => {}, signal);
  await assert.rejects(propose(), /Review these exact goal changes/);
  assert.equal(
    task.observations<{ plannerEdits?: unknown }>().some((event) => event.plannerEdits),
    false,
  );
  task.ask = async () => 'approve';
  const approved = await propose();
  assert.ok('milestones' in approved);
  const observation = task
    .observations<{ plannerEdits?: { edits: { path: string; content: string }[] } }>()
    .find((event) => event.plannerEdits);
  assert.equal(observation?.plannerEdits?.edits[0]?.content, draft.content);
});

function draftFixture(t: TestContext) {
  const scenario = new PlannerRepairScenario(t, []);
  const task = scenario.task;
  const source = task.capture.source;
  const path = '.arc/goals/fixture-goal.md';
  const content = '---\npriority: 1\n---\n\nPrevious outcome\n';
  Object.assign(source, {
    paths: [path],
    read: (requested: string) => {
      assert.equal(requested, path);
      return content;
    },
  });
  return {
    task,
    draft: {
      id: 'fixture-goal',
      revision: source.revision,
      content: content.replace('Previous', 'Updated'),
    },
  };
}
