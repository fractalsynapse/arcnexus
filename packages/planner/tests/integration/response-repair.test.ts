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
  readonly progress: string[] = [];
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
  run(mode: 'exploration' | 'objective' | 'recommendation' = 'exploration') {
    return new Planner({} as Agent).propose(
      this.task,
      mode,
      ({ message }) => this.progress.push(message),
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

test('Planner records the exact goal draft for independent review without a human gate', async (t) => {
  const { task, draft } = draftFixture(t);
  const planner = new Planner({} as Agent);
  const signal = new AbortController().signal;
  await assert.rejects(
    planner.proposeDraft(task, { ...draft, revision: 'stale' }, () => {}, signal),
    /revision is stale/,
  );
  task.ask = async (question) => assert.fail('Unexpected goal approval: ' + question);
  const candidate = await planner.proposeDraft(task, draft, () => {}, signal);
  assert.ok('milestones' in candidate);
  const observation = task
    .observations<{ plannerEdits?: { edits: { path: string; content: string }[] } }>()
    .find((event) => event.plannerEdits);
  assert.equal(observation?.plannerEdits?.edits[0]?.content, draft.content);
});

test('a model-proposed goal change reaches a delivery plan without a human gate', async (t) => {
  const scenario = new PlannerRepairScenario(t, [
    {
      ...valid,
      changes: [
        {
          id: 'reliable-checks',
          content: '---\npriority: 1\n---\n# Checks\n\n## Success measures\nChecks can be rerun.\n',
        },
      ],
    },
  ]);
  scenario.task.ask = async (question) => assert.fail('Unexpected goal approval: ' + question);
  const outcome = await scenario.run();
  assert.ok('milestones' in outcome);
  assert.equal(outcome.milestones[0]?.owner, 'planner');
});

test('an explicit objective resumes the exact review before retaining guide edits', async (t) => {
  const source = { path: 'engineering/intent.txt', quote: 'Keep reliable checks.' };
  const scenario = new PlannerRepairScenario(t, [{ ...valid, sources: [source] }]);
  Object.assign(scenario.task.capture.source, { paths: [source.path], read: () => source.quote });
  const questions: string[] = [];
  scenario.task.ask = async (question) => {
    questions.push(question);
    return questions.length === 1 ? undefined : 'approve';
  };
  await assert.rejects(scenario.run('objective'), /Review this exact objective change/);
  const edits = () =>
    scenario.task
      .observations<{ plannerEdits?: unknown }>()
      .filter(({ plannerEdits }) => plannerEdits);
  assert.equal(edits().length, 0);
  assert.ok('milestones' in (await scenario.run('objective')));
  assert.equal(edits().length, 1);
  assert.equal(scenario.requests.length, 1);
  assert.match(questions[0]!, /\+Assess goals/);
  assert.equal(questions[0], questions[1]);
});

test('saving an exact human objective draft records its authorization without asking again', async (t) => {
  const scenario = new PlannerRepairScenario(t, []);
  const { task } = scenario;
  const path = '.arc/objectives/reliability/preserve-evidence.md';
  const before = '---\nid: preserve-evidence\n---\n# Preserve evidence\n';
  Object.assign(task.capture.source, { paths: [path], read: () => before });
  task.ask = async (question) => assert.fail('Unexpected second objective decision: ' + question);
  const draft = {
    kind: 'objectives' as const,
    id: 'preserve-evidence',
    revision: task.capture.source.revision,
    content: before + '\nRetain the exact evidence.\n',
  };
  const result = await new Planner({} as Agent).proposeDraft(
    task,
    draft,
    () => {},
    new AbortController().signal,
  );
  assert.ok('milestones' in result);
  const authorization = task
    .observations<{ objectiveDraftAuthorization?: { revision: string } }>()
    .find(
      ({ objectiveDraftAuthorization }) => objectiveDraftAuthorization,
    )?.objectiveDraftAuthorization;
  assert.equal(authorization?.revision, draft.revision);
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

test('one approved batch reaches goal alignment with exactly the selected objective wording', async (t) => {
  const path = 'handbook/operations/recovery.adoc';
  const quote = 'Operators rehearse recovery from a failed deployment.';
  const draft = (id: string) => ({
    id,
    category: 'delivery/recovery',
    title: id,
    gap: 'The documented rehearsal is not reflected in the objectives.',
    content: '# Recovery\n\nRehearse recovery.\n',
    sources: [{ path, quote }],
  });
  const scenario = new PlannerRepairScenario(t, [
    {
      summary: 'Recovery gaps',
      drafts: [draft('rehearse-recovery'), draft('record-recovery'), draft('audit-recovery')],
    },
    { ...valid, changes: [recoveryGoal], links: [recoveryGoal.id] },
  ]);
  Object.assign(scenario.task.capture.source, { paths: [path], read: () => quote });
  Object.assign(scenario.task.capture.project, { documentationDirectories: ['handbook'] });
  Object.assign(scenario.task.config, { documentationDirectories: ['handbook/operations'] });
  await inspectRecommendationReview(scenario);
  assert.deepEqual(
    (scenario.requests[0]!.assignment as { documentationDirectories: string[] })
      .documentationDirectories,
    ['handbook/operations'],
  );
});

test('missing configured documentation directories fail before the Planner invokes a model', async (t) => {
  const scenario = new PlannerRepairScenario(t, []);
  Object.assign(scenario.task.capture.project, { documentationDirectories: ['missing/docs'] });
  await assert.rejects(
    scenario.run('recommendation'),
    /Documentation directory is missing.*missing\/docs/,
  );
  assert.equal(scenario.requests.length, 0);
});

const recoveryGoal = {
  id: 'practice-recovery',
  category: 'delivery/recovery',
  content:
    '---\npriority: 1\n---\n# Practice recovery\n\n## Success measures\nRecord evidence from a recovery rehearsal.\n',
};

async function inspectRecommendationReview(scenario: PlannerRepairScenario) {
  let prompts = 0;
  scenario.task.ask = async (_question, _signal, gate) => {
    const review = gate?.review;
    assert.ok(review);
    assert.equal(review.drafts.length, 3);
    prompts++;
    if (prompts === 1) return undefined;
    const id = 'rehearse-recovery';
    const content = review.drafts[0]!.content + '\nRecord recovery duration.\n';
    if (prompts === 2) return JSON.stringify({ action: 'revise', edits: { [id]: content } });
    assert.match(review.drafts[0]!.content, /Record recovery duration/);
    return JSON.stringify({ action: 'approve', selected: [id, 'audit-recovery'] });
  };
  const run = () => scenario.run('recommendation');
  await assert.rejects(run(), /Review objective recommendations/);
  assert.ok('milestones' in (await run()));
  assert.equal(prompts, 3);
  assertBatchAlignment(scenario);
}

function assertBatchAlignment(scenario: PlannerRepairScenario) {
  assert.equal(scenario.requests.length, 2);
  assert.ok(scenario.progress.includes('Planner is aligning goals with the approved objectives.'));
  const assignment = scenario.requests[1]!.assignment as {
    approvedObjectives: { id: string; content: string }[];
  };
  assert.deepEqual(
    assignment.approvedObjectives.map(({ id }) => id),
    ['rehearse-recovery', 'audit-recovery'],
  );
  assert.match(assignment.approvedObjectives[0]!.content, /Record recovery duration/);
  const { plannerEdits } = scenario.task
    .observations<{ plannerEdits?: { edits: { path: string }[] } }>()
    .findLast((event) => event.plannerEdits)!;
  assert.deepEqual(
    plannerEdits!.edits.map(({ path }) => path),
    [
      '.arc/goals/delivery/recovery/practice-recovery.md',
      '.arc/objectives/delivery/recovery/rehearse-recovery.md',
      '.arc/objectives/delivery/recovery/audit-recovery.md',
    ],
  );
}
