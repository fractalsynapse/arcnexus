import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  ExecutionContext,
  type ProjectExecution,
} from '../../../../dist/library/architecture/execution-context.js';
import { EvidencePackageUpstream } from '../../../../dist/library/operations/evidence-package-upstream.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { RunEnvironments } from '../../../../dist/library/execution-runtime/run-environments.js';
import { RunCollaboration } from '../../../../dist/library/execution-runtime/run-collaboration.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Exercises durable provider transitions without a model or replacement collaboration implementation. */
class ProgressFixture {
  readonly fixture: ReturnType<typeof generalCatalogFixture>;

  readonly context: ProjectExecution;

  readonly host: ProjectHost;

  readonly environments: RunEnvironments;

  /** Captures explicit grants and opens ordinary host storage without starting engineering. */
  constructor(t: TestContext, comment = true) {
    this.fixture = generalCatalogFixture(t);
    this.template();
    this.policy(comment);
    this.context = new ExecutionContext().resolve(this.fixture.repo);
    assert.deepEqual(this.context.bindings.tools, {});
    t.after(() => assert.equal(existsSync(this.fixture.calls), false));
    this.host = new ProjectHost(this.fixture.state, this.context);
    this.environments = new RunEnvironments(this.fixture.state, this.context, this.host.store);
    t.after(() => {
      this.environments.effects.close();
      this.host.close();
    });
  }

  /** Adds an owned issue template to the captured fixture, with deliberately reordered headings. */
  private template(): void {
    mkdirSync(join(this.fixture.repo, '.github'), { recursive: true });
    writeFileSync(
      join(this.fixture.repo, '.github/ISSUE_TEMPLATE.md'),
      '## Scope\n\n<!-- Scope -->\n## Summary\n\n<!-- Summary -->\n## Acceptance criteria\n',
    );
    const ownerPath = join(this.fixture.repo, 'architecture/components/a.json');
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
    owner.owns.push('.github');
    writeFileSync(ownerPath, JSON.stringify(owner));
  }

  /** Uses committed shared-operation authority, including an explicit absent-comment case. */
  private policy(comment: boolean): void {
    const f = this.fixture;
    const path = join(f.repo, 'architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    for (const action of comment ? ['issue.create', 'issue.comment'] : ['issue.create']) {
      const id = action.replace('.', '-');
      platform.operations[id] = ['agent'];
      writeFileSync(
        join(f.repo, `architecture/operations/${id}.yaml`),
        JSON.stringify({
          schemaVersion: 4,
          id,
          action,
          kind: 'upstream',
          purpose: 'Retain progress',
          repository: 'sample',
          cwd: '.',
          category: 'cli-check',
          generatedDirectories: [],
          artifacts: [],
        }),
      );
    }
    writeFileSync(path, JSON.stringify(platform));
    f.commit();
  }

  /** Creates actual tracking and a waiting assignment for either production run mode. */
  async start(t: TestContext, workday = false) {
    if (workday) this.host.control('start', true);
    const run = workday ? this.host.store.runs()[0]! : this.host.submit('Track useful work', true);
    const assignment = this.host.store.enqueue(run.id, 'a', 'Bounded work');
    const collaboration = new RunCollaboration(
      this.context,
      this.host.store,
      this.environments,
      run,
      new AbortController().signal,
    );
    t.after(() => collaboration.close());
    await collaboration.tracking(workday ? assignment : undefined);
    this.host.store.updateAssignment(assignment.id, 'waiting');
    const pack = new EvidencePackageUpstream(
      'inspector',
      String(run.environment!.id),
      'repo',
      join(this.environments.directory, run.environment!.id, 'evidence-package.jsonl'),
    );
    return { run, assignment, collaboration, pack };
  }
}

/** Checks real provider state and effect receipts rather than relying on a worker's claim. */
class ProgressScenario {
  /** Repeated observations are read-only and completion carries independently retained evidence. */
  async milestones(t: TestContext, workday: boolean): Promise<void> {
    const f = new ProgressFixture(t);
    const { assignment, collaboration, pack } = await f.start(t, workday);
    const issue = pack.entries().find((entry) => entry.operation === 'issue.create')!;
    assert.match(String(issue.payload.body), /^## Scope\n/);
    assert.match(String(issue.payload.body), /## Summary\n\n/);
    assert.match(String(issue.payload.body), /## Acceptance criteria/);
    await collaboration.progress();
    const events = f.environments.effects.events();
    await collaboration.progress();
    assert.deepEqual(f.environments.effects.events(), events);
    f.host.store.complete(assignment.id, ['independent-review']);
    await collaboration.progress();
    const comments = pack.entries().filter((entry) => entry.operation === 'issue.comment');
    assert.equal(comments.length, 2);
    const bodies = comments.map((comment) => String(comment.payload.body));
    assert.match(bodies[0]!, /\*\*a: waiting\*\*/);
    assert.match(bodies[1]!, /\*\*a: verified component delivery\*\*/);
    assert.match(bodies[1]!, /independent-review/);
    assert.ok(comments.every((comment) => comment.assignmentId === assignment.id));
  }

  /** Historical JSON comments keep their semantic receipt identity after the Markdown upgrade. */
  async historical(t: TestContext): Promise<void> {
    const f = new ProgressFixture(t);
    const { run, assignment, collaboration, pack } = await f.start(t);
    const tracking = f.environments.effects.effects()[0]!;
    const issue = f.host.store.run(run.id).data.trackingIssue as { issueId: string };
    const body = this.historicalBody(assignment);
    const input = { issueId: issue.issueId, body };
    const id =
      run.id + ':progress:' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
    f.environments.effects.prepare({
      ...tracking,
      id,
      assignmentId: assignment.id,
      operation: 'issue.comment',
      input,
      definitionDigest: f.context.catalog.operations['issue-comment']!.definitionDigest!,
    });
    const effect = f.environments.effects.begin(id);
    const result = await new EvidencePackageUpstream(
      'simulated',
      String(run.environment!.id),
      tracking.target,
      join(f.environments.directory, String(run.environment!.id), 'evidence-package.jsonl'),
    ).apply(effect, new AbortController().signal);
    f.environments.effects.complete(id, effect.attempt, result);
    await collaboration.progress();
    const comments = pack.entries().filter((entry) => entry.operation === 'issue.comment');
    assert.equal(comments.length, 1);
    assert.equal(comments[0]!.payload.body, body);
  }

  /** Reproduces the released comment payload so migration checks compare actual prior identities. */
  private historicalBody(assignment: {
    id: string;
    owner: string;
    dependencies: string[];
    evidence: string[];
  }): string {
    return JSON.stringify(
      {
        assignmentId: assignment.id,
        owner: assignment.owner,
        milestone: 'waiting',
        dependencies: assignment.dependencies,
        evidence: assignment.evidence,
      },
      null,
      2,
    );
  }

  /** A lost host receipt is recovered before a changed assignment produces its next comment. */
  async receiptLoss(t: TestContext): Promise<void> {
    const f = new ProgressFixture(t);
    const { assignment, collaboration, pack } = await f.start(t);
    const effects = f.environments.effects;
    const complete = effects.complete.bind(effects);
    effects.complete = () => {
      throw new Error('Injected receipt loss');
    };
    await assert.rejects(collaboration.progress(), /Injected receipt loss/);
    effects.complete = complete;
    assert.equal(pack.entries().filter((entry) => entry.operation === 'issue.comment').length, 1);
    f.host.store.complete(assignment.id, ['independent-review']);
    await collaboration.progress();
    await collaboration.progress();
    assert.equal(pack.entries().filter((entry) => entry.operation === 'issue.comment').length, 2);
    assert.ok(effects.effects().every((effect) => effect.status === 'completed'));
  }

  /** Unknown provider progress cannot be replayed or concealed by a newer assignment observation. */
  async uncertain(t: TestContext): Promise<void> {
    const f = new ProgressFixture(t);
    const { run, assignment, collaboration, pack } = await f.start(t);
    const issue = f.host.store.run(run.id).data.trackingIssue as { issueId: string };
    const input = { issueId: issue.issueId, body: 'Retained uncertain milestone' };
    const id =
      run.id + ':progress:' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const definition = f.context.catalog.operations['issue-comment']!;
    const tracking = f.environments.effects.effects()[0]!;
    f.environments.effects.prepare({
      environmentId: tracking.environmentId,
      runId: run.id,
      target: tracking.target,
      id,
      assignmentId: assignment.id,
      operation: 'issue.comment',
      definitionDigest: definition.definitionDigest!,
      input,
    });
    pack.markAttempted(f.environments.effects.begin(id));
    await assert.rejects(collaboration.progress(), /requires reconciliation/);
    assert.equal(f.environments.effects.effect(id).status, 'uncertain');
    assert.equal(pack.entries().filter((entry) => entry.operation === 'issue.comment').length, 0);
  }
}

const scenario = new ProgressScenario();

test('historical milestone receipts do not repost after a formatting upgrade', (t) =>
  scenario.historical(t));

for (const workday of [false, true])
  test(`${workday ? 'workday' : 'task'} milestones retain one authorized comment per meaningful state`, (t) =>
    scenario.milestones(t, workday));

test('progress recovers a provider comment after host receipt loss without duplication', (t) =>
  scenario.receiptLoss(t));

test('uncertain progress prevents blind replay and new milestone dispatch', (t) =>
  scenario.uncertain(t));

test('missing comment grants preserve tracking without inventing upstream authority', async (t) => {
  const f = new ProgressFixture(t, false);
  const { collaboration, pack } = await f.start(t);
  await collaboration.progress();
  assert.deepEqual(
    pack.entries().map((entry) => entry.operation),
    ['issue.create'],
  );
});

test('foreign-environment issue references cannot receive milestone comments', async (t) => {
  const f = new ProgressFixture(t);
  const { assignment, collaboration, pack } = await f.start(t);
  const tracking = f.environments.effects.effects()[0]!;
  const foreign = await new EvidencePackageUpstream(
    'foreign',
    'foreign',
    tracking.target,
    join(f.environments.directory, 'foreign', 'evidence-package.jsonl'),
  ).apply(
    { ...tracking, id: 'foreign-issue', environmentId: 'foreign' },
    new AbortController().signal,
  );
  f.host.store.updateAssignment(assignment.id, 'waiting', {
    trackingIssue: { issueId: foreign.issueId },
  });
  await assert.rejects(collaboration.progress(), /not an issue in this environment/);
  assert.equal(pack.entries().filter((entry) => entry.operation === 'issue.comment').length, 0);
  assert.equal(foreign.revision, 1, 'the foreign namespace is untouched');
});

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'lifecycle-effects'],
});
