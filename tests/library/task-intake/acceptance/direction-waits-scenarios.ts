import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { Direction } from '../../../../dist/library/task-intake/direction.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

type Wait = ReturnType<ExecutionStore['escalations']['open']>;

const goal = 'Inspect recorded project waits';

const heading = '\nOutstanding project waits:\n';

const emptyPromptSha256 = '14a403013aa6faf4fa75ede0fc4bea0b2355faacd08cc33ba9afb16f1d2ae9fb';

/** Observes retained planning input through the built public direction path before native dispatch. */
export class DirectionWaitScenarios {
  /** Includes all project runs and reasons while excluding closed waits and another project. */
  async populated(t: TestContext): Promise<void> {
    const { f, waits, before } = this.populatedFixture(t);
    const observed = await f.capturedPrompt();
    assert.equal(this.section(observed), this.expected(waits));
    assert.doesNotMatch(observed, /CLOSED_WAIT_SECRET|FOREIGN_WAIT_SECRET/);
    assert.equal(JSON.stringify(f.store.escalations.outstanding()), before);
  }

  /** Native completion retains the original ready-result and no-human-gate assertions. */
  async completion(t: TestContext): Promise<void> {
    const { f, waits, before } = this.populatedFixture(t);
    const observed = await f.prompt();
    assert.equal(this.section(observed.prompt), this.expected(waits));
    assert.doesNotMatch(observed.prompt, /CLOSED_WAIT_SECRET|FOREIGN_WAIT_SECRET/);
    assert.equal(observed.result.status, 'ready');
    assert.deepEqual(observed.result.questions, []);
    assert.equal(observed.result.architectureProposal, null);
    assert.equal(JSON.stringify(f.store.escalations.outstanding()), before);
  }

  /** Shares complete project, closed and foreign wait setup between capture and native completion. */
  private populatedFixture(t: TestContext) {
    const f = new DirectionWaitFixture(t);
    const current = f.open('a', 'Waiting on "evidence"\nfrom b', 2);
    const previous = f.open('b', 'Waiting on a prior run', 1, f.previousRunId);
    const additional = f.open('a', 'Waiting on a different contribution', 0);
    const closed = f.open('c', 'CLOSED_WAIT_SECRET', 3);
    f.store.escalations.close(closed.id, 'Already resolved');
    f.foreignWait();
    const before = JSON.stringify(f.store.escalations.outstanding());
    return { f, waits: [current, previous, additional], before };
  }

  /** Fixed timestamps expose a stable identity tie break across repeated direction activations. */
  async deterministic(t: TestContext): Promise<void> {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 10) });
    const f = new DirectionWaitFixture(t);
    const oldest = f.open('c', 'Oldest project wait', 0, f.previousRunId);
    t.mock.timers.tick(1000);
    const first = f.open('b', 'Tied wait b', 1);
    const second = f.open('a', 'Tied wait a', 2);
    assert.equal(first.openedAt, second.openedAt);
    const before = JSON.stringify(f.store.escalations.outstanding());
    const one = this.section(await f.capturedPrompt());
    const two = this.section(await f.capturedPrompt());
    assert.equal(one, two, 'DIRECTION_WAIT_ORDER: unchanged waits must render identical bytes');
    assert.equal(one, this.expected([oldest, first, second]));
    assert.equal(JSON.stringify(f.store.escalations.outstanding()), before);
  }

  /** Empty, closed-only and foreign-only state retain the complete pre-change prompt bytes. */
  async empty(t: TestContext): Promise<void> {
    const f = new DirectionWaitFixture(t);
    const initial = await f.capturedPrompt();
    assert.equal(createHash('sha256').update(initial).digest('hex'), emptyPromptSha256);
    const closed = f.open('a', 'CLOSED_WAIT_SECRET', 1);
    f.store.escalations.close(closed.id, 'Resolved before planning');
    f.foreignWait();
    const after = await f.capturedPrompt();
    assert.equal(
      after,
      initial,
      'DIRECTION_WAIT_EMPTY: no outstanding project waits change no bytes',
    );
    assert.equal(after.includes(heading), false);
  }

  /** Reading a project without recorded coordination state must not create a new database. */
  async absent(t: TestContext): Promise<void> {
    const f = new DirectionWaitFixture(t, false);
    assert.equal(existsSync(f.database), false);
    const observed = await f.capturedPrompt();
    assert.equal(createHash('sha256').update(observed).digest('hex'), emptyPromptSha256);
    assert.equal(existsSync(f.database), false);
  }

  /** Fails specifically on the missing prompt behavior before checking the complete section contract. */
  private section(prompt: string): string {
    const start = prompt.indexOf(heading);
    assert.ok(
      start >= 0,
      'DIRECTION_WAIT_VISIBILITY: outstanding project waits must reach planning',
    );
    return prompt.slice(start);
  }

  /** Expresses the documented row bytes and chronological ordering with an identity tie break. */
  private expected(waits: Wait[]): string {
    const ordered = [...waits].sort((a, b) => {
      if (a.openedAt !== b.openedAt) return a.openedAt < b.openedAt ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return (
      heading +
      ordered
        .map(
          (wait) =>
            '- owner=' +
            JSON.stringify(wait.owner) +
            '; assignment=' +
            JSON.stringify(wait.assignmentId) +
            '; reason=' +
            JSON.stringify(wait.reason) +
            '; open steps=' +
            wait.openSteps.length,
        )
        .join('\n')
    );
  }
}

/** Builds isolated project state and reuses the existing deterministic SDK responder. */
class DirectionWaitFixture {
  readonly fixture;

  readonly context;

  readonly workspace;

  readonly database: string;

  readonly store: ExecutionStore;

  readonly runId: string;

  readonly previousRunId: string;

  private prepared = false;

  /** Captures a normal catalog and canonical project database without relying on live resources. */
  constructor(t: TestContext, recordedState = true) {
    this.fixture = generalCatalogFixture(t);
    const f = this.fixture;
    this.responder();
    this.context = new ExecutionContext().resolve(f.repo);
    this.context.executable = f.executable;
    for (const name of ['runs', 'workspaces']) mkdirSync(join(f.state, name), { recursive: true });
    this.workspace = createWorkspace(f.state, { project: f.repo, bindings: this.context.bindings });
    this.database = join(f.state, 'projects', this.context.key, 'execution.sqlite');
    this.store = new ExecutionStore(recordedState ? this.database : join(f.state, 'unused.sqlite'));
    t.after(() => this.store.close());
    this.previousRunId = this.store.createRun('task', ['a', 'b', 'c'], 'Earlier goal').id;
    this.runId = this.store.createRun('task', ['a', 'b', 'c'], goal).id;
    if (recordedState) this.workspace.executionRunId = this.runId;
  }

  /** Records multiple reasons against the same owner assignment using only the store's public API. */
  open(owner: string, reason: string, count: number, runId = this.runId): Wait {
    const assignment =
      this.store.assignments(runId).find((item) => item.owner === owner) ??
      this.store.enqueue(runId, owner, 'Owned waiting work', ['Observed evidence']);
    return this.store.escalations.open({
      runId,
      assignmentId: assignment.id,
      owner,
      goal: { objective: assignment.objective, acceptance: assignment.acceptance },
      reason,
      openSteps: Array.from({ length: count }, (_, index) => ({
        id: 'step-' + index,
        activity: 'testing',
        status: 'pending',
      })),
      evidence: [],
    });
  }

  /** Places a real outstanding wait in a separate project's canonical database. */
  foreignWait(): void {
    const path = join(this.fixture.state, 'projects', 'another-project', 'execution.sqlite');
    const store = new ExecutionStore(path);
    try {
      const run = store.createRun('task', ['c'], 'Foreign project goal');
      const assignment = store.enqueue(run.id, 'c', 'Foreign wait');
      store.escalations.open({
        runId: run.id,
        assignmentId: assignment.id,
        owner: assignment.owner,
        goal: { objective: assignment.objective, acceptance: assignment.acceptance },
        reason: 'FOREIGN_WAIT_SECRET',
        openSteps: [],
        evidence: [],
      });
    } finally {
      store.close();
    }
  }

  /** Cancels before command dispatch and checks the actual prompt retained by public direction. */
  async capturedPrompt(): Promise<string> {
    await this.prepare();
    const root = join(this.fixture.state, 'runs');
    const before = new Set(readdirSync(root));
    const cancellation = new Error('Direction prompt capture cancelled before model dispatch');
    const signal = AbortSignal.abort(cancellation);
    const direction = new Direction(this.fixture.state, this.context, signal);
    await assert.rejects(
      direction.propose(this.workspace, goal),
      (error) => error === cancellation,
    );
    const created = readdirSync(root).filter((id) => !before.has(id));
    assert.equal(created.length, 1, 'Public direction must retain exactly one activation');
    const directory = join(root, created[0]!);
    const record = JSON.parse(readFileSync(join(directory, 'report.json'), 'utf8'));
    assert.equal(record.status, 'failed');
    assert.equal(record.error, String(cancellation));
    assert.equal(record.readOnlyTurn, true);
    assert.equal(record.activationRole, 'director');
    assert.equal(existsSync(join(directory, 'sandbox-preflight.json')), false);
    assert.equal(existsSync(this.fixture.calls), false);
    return readFileSync(join(directory, 'prompt.txt'), 'utf8');
  }

  /** Invokes public direction and reads the exact instructions received by the scripted executable. */
  async prompt() {
    await this.prepare();
    const direction = new Direction(this.fixture.state, this.context, new AbortController().signal);
    const result = await direction.propose(this.workspace, goal);
    const calls = readFileSync(this.fixture.calls, 'utf8').trim().split('\n');
    return { result, prompt: JSON.parse(calls.at(-1)!).prompt as string };
  }

  /** Prepares one ordinary workspace shared by repeated public direction activations. */
  private async prepare(): Promise<void> {
    if (this.prepared) return;
    await prepareWorkspace(this.fixture.state, this.workspace, new AbortController().signal);
    this.prepared = true;
  }

  /** Uses the existing process responder; this deterministic test does not claim native confinement qualification. */
  private responder(): void {
    const module = new URL('../../testing/support/controlled-general.js', import.meta.url).href;
    const program =
      '#!/usr/bin/env node\nimport(' +
      JSON.stringify(module) +
      ').then(({ControlledGeneral}) => new ControlledGeneral(' +
      JSON.stringify(this.fixture.calls) +
      ').run());\n';
    writeFileSync(this.fixture.executable, program, { mode: 0o755 });
  }
}
