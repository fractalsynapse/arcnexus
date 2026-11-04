import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProviderStore } from '../../../../dist/library/coordination-store/provider-store.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { RunEnvironments } from '../../../../dist/library/execution-runtime/run-environments.js';
import { RunCollaboration } from '../../../../dist/library/execution-runtime/run-collaboration.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture } from '../../testing/support/general-fixture.js';

/** Exercises durable provider transitions without a model or replacement collaboration implementation. */
class ProgressFixture {
  readonly general: GeneralFixture;

  readonly context;

  readonly host: ProjectHost;

  readonly environments: RunEnvironments;

  /** Captures explicit grants and opens ordinary host storage without starting engineering. */
  constructor(t: TestContext, comment = true) {
    this.general = new GeneralFixture(t);
    this.policy(comment);
    this.context = new ExecutionContext().resolve(this.general.fixture.repo);
    this.host = new ProjectHost(this.general.fixture.state, this.context);
    this.environments = new RunEnvironments(
      this.general.fixture.state,
      this.context,
      this.host.store,
    );
    t.after(() => {
      this.environments.effects.close();
      this.host.close();
    });
  }

  /** Uses committed shared-operation authority, including an explicit absent-comment case. */
  private policy(comment: boolean): void {
    const f = this.general.fixture;
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
          activities: [],
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
    const provider = new ProviderStore(
      join(this.environments.directory, run.environment!.id, 'provider.sqlite'),
    );
    t.after(() => provider.close());
    return { run, assignment, collaboration, provider };
  }
}

/** Checks real provider state and effect receipts rather than relying on a worker's claim. */
class ProgressScenario {
  /** Repeated observations are read-only and completion carries independently retained evidence. */
  async milestones(t: TestContext, workday: boolean): Promise<void> {
    const f = new ProgressFixture(t);
    const { assignment, collaboration, provider } = await f.start(t, workday);
    await collaboration.progress();
    const events = f.environments.effects.events();
    await collaboration.progress();
    assert.deepEqual(f.environments.effects.events(), events);
    f.host.store.complete(assignment.id, ['independent-review']);
    await collaboration.progress();
    const comments = provider.resources().filter((resource) => resource.kind === 'comment');
    assert.equal(comments.length, 2);
    const bodies = comments.map((comment) => JSON.parse(String(comment.data.body)));
    assert.deepEqual(
      bodies.map((body) => body.milestone),
      ['waiting', 'verified_delivery'],
    );
    assert.deepEqual(bodies[1].evidence, ['independent-review']);
    assert.ok(comments.every((comment) => comment.data.assignmentId === assignment.id));
  }

  /** A lost host receipt is recovered before a changed assignment produces its next comment. */
  async receiptLoss(t: TestContext): Promise<void> {
    const f = new ProgressFixture(t);
    const { assignment, collaboration, provider } = await f.start(t);
    const effects = f.environments.effects;
    const complete = effects.complete.bind(effects);
    effects.complete = () => {
      throw new Error('Injected receipt loss');
    };
    await assert.rejects(collaboration.progress(), /Injected receipt loss/);
    effects.complete = complete;
    assert.equal(provider.resources().filter((resource) => resource.kind === 'comment').length, 1);
    f.host.store.complete(assignment.id, ['independent-review']);
    await collaboration.progress();
    await collaboration.progress();
    assert.equal(provider.resources().filter((resource) => resource.kind === 'comment').length, 2);
    assert.ok(effects.effects().every((effect) => effect.status === 'completed'));
  }

  /** Unknown provider progress cannot be replayed or concealed by a newer assignment observation. */
  async uncertain(t: TestContext): Promise<void> {
    const f = new ProgressFixture(t);
    const { run, assignment, collaboration, provider } = await f.start(t);
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
    provider.start(f.environments.effects.begin(id));
    await assert.rejects(collaboration.progress(), /requires reconciliation/);
    assert.equal(f.environments.effects.effect(id).status, 'uncertain');
    assert.equal(provider.resources().filter((resource) => resource.kind === 'comment').length, 0);
  }
}

const scenario = new ProgressScenario();

for (const workday of [false, true])
  test(`${workday ? 'workday' : 'task'} milestones retain one authorized comment per meaningful state`, (t) =>
    scenario.milestones(t, workday));

test('progress recovers a provider comment after host receipt loss without duplication', (t) =>
  scenario.receiptLoss(t));

test('uncertain progress prevents blind replay and new milestone dispatch', (t) =>
  scenario.uncertain(t));

test('missing comment grants preserve tracking without inventing upstream authority', async (t) => {
  const f = new ProgressFixture(t, false);
  const { collaboration, provider } = await f.start(t);
  await collaboration.progress();
  assert.deepEqual(
    provider.resources().map((resource) => resource.kind),
    ['issue'],
  );
});

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
