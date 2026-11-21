import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { parse } from 'yaml';
import {
  InvalidAgentResponse,
  type ActivationInput,
  type Agent,
} from '../../../agent/src/index.js';
import type { Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../src/index.js';
import { checkInput, reusableCheck } from '../../src/check-cache.js';
import { archiveResearch, pendingResearch } from '../../src/research-archive.js';
import { verify } from '../../../verification/src/index.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['regression'],
} as const;

const request = {
  kind: 'research',
  question: 'Does the upstream API guarantee stable ordering?',
  decision: 'Choose the expected ordering in the fixture',
};
const report = {
  kind: 'research-report',
  summary: 'The API documents stable ordering.',
  findings: 'Ordering is stable for a fixed input.',
  sources: [{ url: 'https://example.com/api', note: 'Ordering guarantee' }],
  applicability: 'Applies to the documented API version',
  unresolved: [],
  reusable: true,
};
const signal = new AbortController().signal;

/** Exercise the native task inbox with a scripted Agent and the real journal. */
class ResearchScenario {
  readonly activations: ActivationInput[] = [];
  clarify?: () => Promise<string | undefined>;
  private readonly base = mkdtempSync(join(tmpdir(), 'arcnexus-research-'));
  private readonly root = join(this.base, 'repo');
  private readonly storage = join(this.base, 'state');
  private readonly coordination = new Coordination(this.storage);
  private readonly capture: Capture;
  checks = 0;

  /** Set up a local Git source without a delivery branch or task worktree. */
  constructor(t: TestContext, operations = ['read-file', 'list-files']) {
    t.after(() => rmSync(this.base, { force: true, recursive: true }));
    mkdirSync(this.root);
    execFileSync('git', ['init', '-q', this.root]);
    execFileSync('git', [
      '-C',
      this.root,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'Committed research fixture',
    ]);
    this.capture = researchCapture(this.root, operations);
  }

  /** Run an actor and capture the actual selections and supplied research evidence. */
  async activate(component: string, activity: string, replies: unknown[]) {
    return this.withTask('Research fixture', (task) =>
      task.activate(this.agent(replies), { component, activity }, { milestone: 'fixture' }, signal),
    );
  }

  /** Archive a retained report through the same owner edit operation from a fresh goal. */
  archive(owner: string, lookup = owner) {
    return this.withTask('Archive fixture', async (task) => {
      task.worktree = this.root;

      const [report] = pendingResearch(task, lookup);
      assert(report?.path);
      assert('evidence' in report, 'A pending report needs its readable source before archival');
      assert.equal(typeof report.evidence, 'string');
      const retained = task.readFile(String(report.evidence));
      assert.match(retained.text, /Ordering is stable for a fixed input/);
      const edits = archiveResearch(task, owner, [report.id]);
      task.edits(owner, 'documentation', edits);
      assert.deepEqual(archiveResearch(task, owner, [report.id]), []);
      return readFileSync(join(this.root, report.path), 'utf8');
    });
  }

  /** Keep the real Verification and Reviewer around a scripted learner. */
  review(replies: unknown[]) {
    return this.withTask('Review fixture', async (task) => {
      this.prepareReviewCheck(task);
      if (!replies.length)
        replies.push((input: ActivationInput) => {
          const assignment = input.task.assignment as { accepted: object };
          return { ...assignment.accepted, criteria: [], evidence: [task.evidence[0]] };
        });
      const plan = {
        focus: { purpose: 'fixture', objectives: [], constraints: [] },
        milestones: [],
      };
      return verify(this.agent(replies), task, plan, { digest: 'candidate', evidence: [] }, signal);
    });
  }

  /** Seed controlled check evidence once; the real host validates and reuses its committed inputs. */
  private prepareReviewCheck(task: HostTask) {
    task.worktree = this.root;
    const input = checkInput(task, 'build');
    assert(input, 'Review checks need clean committed fixture inputs');
    if (reusableCheck(task.observations(), input)) return;
    this.checks++;
    const log = task.store(
      'build.log',
      'Controlled checklist observation; no native execution claimed',
    );
    const check = {
      id: 'build',
      log,
      status: 0,
      command: '/usr/bin/true',
      args: [],
      cwd: this.root,
      durationMs: 0,
    };
    task.note({ check, checkInput: input });
  }

  /** Use the same persisted task identity across attempts. */
  private async withTask<T>(goal: string, use: (task: HostTask) => Promise<T>) {
    const journal = this.coordination.admit(this.capture.source.remote, goal);
    assert('close' in journal);
    const task = new HostTask(
      {
        capture: this.capture,
        common: this.root,
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      goal,
      journal,
    );
    try {
      Object.assign(task, { ask: this.clarify });
      return await use(task);
    } finally {
      task.finish({ kind: 'blocked', reason: 'Retain fixture observations', evidence: [] });
      task.close();
    }
  }

  /** Supply model responses without running external tools. */
  private agent(replies: unknown[]) {
    return {
      activate: (input: ActivationInput) => this.answer(input, replies),
    } as unknown as Agent;
  }

  /** Record only the actual calls, throwing when a restart should interrupt the requester. */
  private async answer(input: ActivationInput, replies: unknown[]) {
    this.activations.push(input);
    assert(replies.length, 'Unexpected model activation');
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply(input) : reply;
  }
}

/** Capture the explicit review operation and actors against the fixture's committed source. */
function researchCapture(root: string, operations: string[]): Capture {
  return {
    project: {
      knowledgeRoot: '.arc',
      verifier: { component: 'reviewer', activity: 'assessment' },
      checks: { acceptance: ['build'] },
    },
    contracts: [],
    components: researchComponents(operations),
    operations: {
      build: {
        id: 'build',
        kind: 'check',
        category: 'build',
        command: '/usr/bin/true',
        args: [],
        network: false,
      },
      'read-file': { id: 'read-file', kind: 'tool', category: 'project-tool', tool: 'read' },
      'list-files': { id: 'list-files', kind: 'tool', category: 'project-tool', tool: 'list' },
    },
    source: {
      root: root,
      revision: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      paths: [],
      remote: 'https://example.com',
    },
  } as unknown as Capture;
}

/** Give each generic actor the same explicit read-only research capability. */
function researchComponents(operations: string[]) {
  return Object.fromEntries(
    ['direction', 'reviewer', 'team'].map((id) => [
      id,
      {
        id,
        owns: [`.arc/research/${id}`],
        activities: { research: { profile: 'fixture', operations } },
      },
    ]),
  );
}

test('legacy model research without project tools remains available', async (t) => {
  const fixture = new ResearchScenario(t, []);
  assert.deepEqual(
    await fixture.activate('direction', 'planning', [request, report, { kind: 'plan' }]),
    { kind: 'plan' },
  );
  assert.equal(fixture.activations.length, 3);
});

/** Verify answered gates expose one durable artifact with the unmodified input. */
function verifyClarificationEvidence(
  activations: ActivationInput[],
  component: string,
  activity: string,
  question: string,
  answer: string,
) {
  const evidence = activations.map(({ task }) =>
    task.evidence?.filter((path) => String(path).endsWith('clarification.json')),
  );
  assert.equal(evidence[0]?.length, 1);
  assert.deepEqual(evidence[1], evidence[0]);
  assert.deepEqual(JSON.parse(readFileSync(String(evidence[0]?.[0]), 'utf8')), {
    component,
    activity,
    question,
    answer,
  });
}

for (const [owner, activity] of [
  ['direction', 'planning'],
  ['team', 'testing'],
  ['reviewer', 'assessment'],
] as const) {
  test(`${owner} receives the exact recorded clarification after interruption`, async (t) => {
    const fixture = new ResearchScenario(t);
    const question = { kind: 'question', question: 'Which architecture applies?' };
    const answer = '  Use the current contract.\n\n  Apply only its second clause.  ';
    const prompt = t.mock.fn(async () => answer);
    fixture.clarify = prompt;
    await assert.rejects(
      fixture.activate(owner, activity, [question, new Error('Interrupted')]),
      /Interrupted/,
    );
    await fixture.activate(owner, activity, [{ kind: 'completed' }]);
    assert.equal(prompt.mock.callCount(), 1);
    verifyClarificationEvidence(
      fixture.activations.slice(1),
      owner,
      activity,
      question.question,
      answer,
    );
    for (const activation of fixture.activations.slice(1)) {
      assert.deepEqual(activation.selection, { component: owner, activity });
      assert.deepEqual((activation.task.assignment as Record<string, unknown>).clarifications, [
        { question: question.question, answer },
      ]);
    }
  });
}

for (const [owner, activity] of [
  ['direction', 'planning'],
  ['team', 'testing'],
  ['reviewer', 'assessment'],
] as const) {
  test(`${owner} optionally researches and resumes in the same scope`, async (t) => {
    const fixture = new ResearchScenario(t);
    const completed = { kind: 'completed' };
    assert.deepEqual(
      await fixture.activate(owner, activity, [request, report, completed]),
      completed,
    );
    assert.deepEqual(
      fixture.activations.map(({ selection }) => selection),
      [
        { component: owner, activity },
        { component: owner, activity: 'research' },
        { component: owner, activity },
      ],
    );
    const evidence = fixture.activations[2]?.task.evidence ?? [];
    assert(
      evidence.some(
        (path) =>
          typeof path === 'string' &&
          path.endsWith('research.md') &&
          readFileSync(path, 'utf8').includes(report.summary),
      ),
    );
  });
}

test('a resumed requester reuses a completed report without launching research again', async (t) => {
  const fixture = new ResearchScenario(t);
  await assert.rejects(
    fixture.activate('direction', 'planning', [request, report, new Error('Interrupted')]),
    /Interrupted/,
  );
  assert.deepEqual(await fixture.activate('direction', 'planning', [{ kind: 'plan' }]), {
    kind: 'plan',
  });
  assert.equal(
    fixture.activations.filter(({ selection }) => selection.activity === 'research').length,
    1,
  );
  assert(
    fixture.activations.at(-1)?.task.evidence?.some((path) => String(path).endsWith('research.md')),
  );
});

test('an actor can finish in a single activation with no research request', async (t) => {
  const fixture = new ResearchScenario(t);
  assert.deepEqual(await fixture.activate('reviewer', 'assessment', [{ kind: 'accepted' }]), {
    kind: 'accepted',
  });
  assert.equal(fixture.activations.length, 1);
});

test('a later owner task can archive exact retained Markdown with checked edits', async (t) => {
  const fixture = new ResearchScenario(t);
  await fixture.activate('direction', 'planning', [request, report, { kind: 'plan' }]);
  await assert.rejects(
    fixture.archive('team', 'direction'),
    /No reusable research report for team/,
  );
  const archived = await fixture.archive('direction');
  assert.match(archived, /Ordering is stable for a fixed input/);
  assert.match(archived, /https:\/\/example.com\/api/);
});

test('Reviewer research resumes the same candidate with one checklist and binds the report', async (t) => {
  const fixture = new ResearchScenario(t);
  await assert.rejects(fixture.review([request, report, new Error('Interrupted')]), /Interrupted/);
  const verdict = await fixture.review([]);
  assert.equal(verdict.kind, 'accepted');
  assert.equal(verdict.candidate, 'candidate');
  assert.match(verdict.research?.[0] ?? '', /research\.md$/);
  assert.equal(fixture.checks, 1);
  assert.equal(
    fixture.activations.filter(({ selection }) => selection.activity === 'research').length,
    1,
  );
});

/** Exercise complete prose, source references and open questions beyond the removed arbitrary caps. */
function detailedReport() {
  return {
    ...report,
    summary: 'Detailed summary. '.repeat(100),
    findings: 'Complete researched finding. '.repeat(1000),
    applicability: 'Applicable implementation conditions. '.repeat(100),
    sources: Array.from({ length: 20 }, (_, index) => ({
      url: `https://example.com/${index}/${'source/'.repeat(400)}`,
      note: 'Evidence and its relevance. '.repeat(100),
    })),
    unresolved: Array.from({ length: 20 }, () => 'Open research question. '.repeat(100)),
  };
}

test('research repairs malformed responses and preserves a complete detailed report', async (t) => {
  const fixture = new ResearchScenario(t);
  const detailed = detailedReport();
  assert.deepEqual(
    await fixture.activate('team', 'testing', [
      request,
      new InvalidAgentResponse('Malformed research JSON'),
      detailed,
      { kind: 'completed' },
    ]),
    { kind: 'completed' },
  );
  const research = fixture.activations.filter(({ selection }) => selection.activity === 'research');
  assert.equal(research.length, 2);
  assert.match(JSON.stringify(research[1]?.task.assignment), /Malformed research JSON/);
  const evidence = fixture.activations
    .at(-1)
    ?.task.evidence?.find((path) => String(path).endsWith('research.md'));
  const markdown = readFileSync(String(evidence), 'utf8');
  const metadata = parse(/^---\n([\s\S]*?)\n---/.exec(markdown)![1]!);
  assert.equal(metadata.summary, detailed.summary);
  for (const text of [
    detailed.findings,
    detailed.applicability,
    ...detailed.sources.flatMap((source) => [source.url, source.note]),
    ...detailed.unresolved,
  ])
    assert(markdown.includes(text));
});

test('unchanged research report failure is retained as optional unavailability', async (t) => {
  const fixture = new ResearchScenario(t);
  const invalid = { ...report, findings: null };
  assert.deepEqual(
    await fixture.activate('team', 'testing', [request, invalid, invalid, { kind: 'completed' }]),
    { kind: 'completed' },
  );
  assert.equal(
    fixture.activations.filter(({ selection }) => selection.activity === 'research').length,
    2,
  );
  const assignment = fixture.activations.at(-1)?.task.assignment as {
    researchResults: { unavailable: boolean; evidence: string }[];
  };
  assert.equal(assignment.researchResults[0]?.unavailable, true);
  assert.match(
    readFileSync(assignment.researchResults[0]!.evidence, 'utf8'),
    /unchanged.*findings.*nonempty/,
  );
});
