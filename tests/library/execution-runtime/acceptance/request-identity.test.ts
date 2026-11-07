import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { Scheduler } from '../../../../dist/library/execution-runtime/scheduler.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { AssignmentExecution } from '../../../../dist/library/execution-runtime/assignment-execution.js';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { AssignmentRegistry } from '../../../../dist/library/report/report.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';
import { readSchema } from '../../../../dist/library/architecture/schema.js';

/** Exercises actual request transactions and scheduler failure isolation with controlled activation results. */
class RequestIdentityScenario {
  readonly store: ExecutionStore;

  readonly run;

  readonly sender;

  readonly supplier;

  /** Creates one current run and two genuine assignments in private durable storage. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-request-identity-'));
    this.store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      this.store.close();
      rmSync(root, { recursive: true, force: true });
    });
    this.run = this.store.createRun('task', ['a', 'b'], 'Controlled goal');
    this.sender = this.store.enqueue(this.run.id, 'a', 'Request work');
    this.supplier = this.store.enqueue(this.run.id, 'b', 'Supply', ['Observed']);
  }

  /** Rejects invalid supplier identities before persisting a dependency or inbox request. */
  invalid(): void {
    const foreign = this.store.createRun('task', ['b'], 'Foreign goal');
    const other = this.store.enqueue(foreign.id, 'b', 'Supply', ['Observed']);
    for (const id of ['simulation:issue:task:tracking', this.sender.id, other.id, '']) {
      assert.throws(() => this.store.request(this.sender.id, this.request(id)), {
        name: 'DependencyBlocked',
      });
      assert.deepEqual(this.store.assignment(this.sender.id).dependencies, []);
      assert.deepEqual(this.store.inbox(this.sender.id), []);
    }
    assert.equal(
      this.store.request(this.sender.id, this.request(this.supplier.id)).id,
      this.supplier.id,
    );
  }

  /** Keeps failed fan-out atomic, preserves rejected intent and lets unrelated ready work finish. */
  async scheduled(): Promise<void> {
    const requests = [
      { ...this.request(undefined), key: 'new' },
      this.request('simulation:issue:task:tracking'),
    ];
    const result = { kind: 'request' as const, requests };
    await new Scheduler(this.store, async () => result).step(this.run.id);
    const rejected = this.store.assignment(this.sender.id);
    assert.equal(rejected.status, 'blocked');
    assert.deepEqual(rejected.data.lastFailedOutcome, JSON.parse(JSON.stringify(result)));
    assert.match(String(rejected.data.reason), /Invalid supplier assignment/);
    assert.deepEqual(this.store.inbox(this.sender.id), []);
    assert.equal(this.store.assignments(this.run.id).length, 2);
    await new Scheduler(this.store, async () => ({
      kind: 'completed',
      evidence: ['Controlled independent result'],
    })).step(this.run.id);
    assert.equal(this.store.assignment(this.supplier.id).status, 'completed');
    assert.equal(this.store.assignment(this.sender.id).status, 'blocked');
  }

  /** Specifies deliberate sharing while keeping requester terms distinct from supplier scope. */
  private request(existingAssignmentId: string | undefined) {
    return {
      key: 'link',
      owner: 'b',
      objective: 'Supply',
      acceptance: ['Observed'],
      existingAssignmentId,
    };
  }
}

test('dependency links distinguish supplier assignments from other resource identities', (t) =>
  new RequestIdentityScenario(t).invalid());

test('invalid dependency fan-out blocks honestly while unrelated work completes', (t) =>
  new RequestIdentityScenario(t).scheduled());

test('active request schema explains null and explicit supplier identity', () => {
  const description =
    readSchema('general-agent-result').properties.requests.items.properties.assignmentId
      .description;
  assert.match(description, /null.*distinct.*work/i);
  assert.match(description, /existing (?:recipient|supplier) assignment/i);
  assert.match(description, /canonical accepted objective/i);
  assert.doesNotMatch(description, /matching owner, objective, acceptance and scope/i);
  assert.match(description, /Never use a tracking issue ID/);
});

/** Exercises production admission, routing and retained evidence without replacing either public store contract. */
class CanonicalSupplierScenario {
  readonly f;

  readonly store;

  readonly sender;

  readonly supplier;

  readonly execution;

  readonly record: any;

  /** Captures real package authority, an accepted supplier and a requester checkpoint in isolated storage. */
  constructor(t: TestContext) {
    this.f = generalCatalogFixture(t);
    this.store = new ExecutionStore(join(this.f.state, 'execution.sqlite'));
    t.after(() => this.store.close());
    const run = this.store.createRun('task', ['a', 'b', 'c'], 'Assemble supplier evidence');
    this.sender = this.store.enqueue(run.id, 'a', 'Integrate runtime behavior');
    this.supplier = this.store.enqueue(run.id, 'b', 'Supply canonical evidence', [
      'Observed proof',
    ]);
    this.store.updateAssignment(this.supplier.id, 'ready', {
      proposal: { kind: 'research', changeType: 'behavior' },
    });
    this.store.accept(this.supplier.id);
    this.execution = new AssignmentExecution(
      this.f.state,
      new ExecutionContext().resolve(this.f.repo),
      this.store,
      new AbortController().signal,
    );
    this.record = this.checkpoint();
  }

  /** Retains enough ordinary checkpoint identity for admission to save genuine rejection diagnostics. */
  private checkpoint(): any {
    mkdirSync(join(this.f.state, 'runs', this.sender.id), { recursive: true });
    return {
      id: this.sender.id,
      source: this.f.repo,
      workspace: this.f.repo,
      branch: 'staging',
      base: this.f.git('rev-parse', 'HEAD'),
      commonDir: join(this.f.repo, '.git'),
      status: 'running',
      startedAt: new Date().toISOString(),
      environment: {},
      commands: [],
      checkpoint: { sha256: 'canonical-supplier-checkpoint' },
    };
  }

  /** Describes the requester's use of the supplier without copying canonical terms or workflow. */
  private request(id: string | null = this.supplier.id, ownerId = 'b') {
    return {
      fromComponent: 'a',
      ownerId,
      request: 'I need evidence to decide whether runtime integration can proceed',
      evidence: [],
      acceptanceCriteria: ['Use the evidence in the caller integration decision'],
      reason: 'Reuse the accepted supplier contribution',
      assignmentId: id,
      milestone: 'delivered',
      kind: 'change' as const,
      changeType: 'documentation' as const,
    };
  }

  /** Invokes the actual activation conversion boundary rather than copying its admission or mapping logic. */
  private route(requests = [this.request()]): any {
    return (this.execution as any).requests(this.sender, this.record, requests);
  }

  /** Discovers the accepted supplier and preserves its canonical contract beside caller evidence. */
  async linked(): Promise<void> {
    await this.discover();
    const before = this.store.assignment(this.supplier.id);
    const outcome = this.route();
    assert.equal(
      outcome.kind,
      'request',
      'Canonical supplier link admits differing requester purpose',
    );
    new Scheduler(this.store, async () => outcome).commit(this.sender.id, outcome);
    const after = this.store.assignment(this.supplier.id);
    assert.deepEqual(after, before, 'Linking must preserve the accepted supplier contract');
    assert.deepEqual(after.data.proposal, { kind: 'research', changeType: 'behavior' });
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
    assert.deepEqual(this.store.assignment(this.sender.id).dependencies, [before.id]);
    const [message] = this.store.inbox(this.sender.id);
    assert.ok(message, 'Linked supplier creates a retained inbox purpose');
    assert.equal(message.assignmentId, before.id);
    assert.equal(message.objective, this.request().request);
    assert.deepEqual(message.acceptance, this.request().acceptanceCriteria);
    assert.equal(this.store.assignment(this.sender.id).status, 'waiting');
    this.replay(outcome);
    this.milestones(message.id);
  }

  /** Confirms the current-run manifest exposes the supplier's accepted canonical intent. */
  private async discover(): Promise<void> {
    const pages = new AssignmentRegistry(this.store).capture(this.sender);
    const manifest = await this.page(pages, 'manifest');
    const entry = manifest.assignments.find((item: any) => item.owner === 'b');
    const intent = await this.page(pages, entry.artifact);
    assert.equal(intent.assignmentId, this.supplier.id);
    assert.equal(intent.accepted, true);
    assert.equal(intent.objective, this.supplier.objective);
    assert.deepEqual(intent.acceptance, this.supplier.acceptance);
  }

  /** Reads complete intent using the same assignment evidence capability exposed to engineering sessions. */
  private async page(pages: any, artifact: string): Promise<any> {
    const page = await pages.call('assignment.evidence', { artifact });
    assert.equal(page.complete, true);
    return JSON.parse(page.content);
  }

  /** Replays the observed activation once and rejects changes under the retained request identity. */
  private replay(outcome: any): void {
    const scheduler = new Scheduler(this.store, async () => outcome);
    scheduler.commit(this.sender.id, outcome);
    assert.equal(this.store.inbox(this.sender.id).length, 1);
    const changed = { ...outcome.requests[0], objective: 'Changed caller purpose' };
    assert.throws(() => this.store.request(this.sender.id, changed), /different content/);
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
  }

  /** Keeps an accepted supplier distinct from verified delivery and strengthens the same inbox dependency. */
  private milestones(requestId: string): void {
    const accepted = { ...this.request(), milestone: 'accepted' };
    this.record.checkpoint.sha256 = 'accepted-intent-checkpoint';
    const outcome = this.route([accepted]);
    assert.equal(outcome.kind, 'request');
    new Scheduler(this.store, async () => outcome).commit(this.sender.id, outcome);
    assert.equal(this.store.assignment(this.sender.id).status, 'waiting');
    this.store.respond(this.sender.id, [
      {
        requestId,
        action: 'require_delivery',
        text: 'Integration needs verified supplier artifacts',
      },
    ]);
    assert.equal(this.store.assignment(this.sender.id).status, 'waiting');
    this.store.complete(this.supplier.id, ['Independently verified supplier proof']);
    assert.equal(this.store.assignment(this.sender.id).status, 'ready');
  }

  /** Releases accepted intent, then strengthens the same request to require verified supplier delivery. */
  accepted(): void {
    const outcome = this.route([{ ...this.request(), milestone: 'accepted' }]);
    assert.equal(outcome.kind, 'request', 'Accepted supplier intent admits a caller-purpose link');
    const scheduler = new Scheduler(this.store, async () => outcome);
    scheduler.commit(this.sender.id, outcome);
    assert.equal(this.store.assignment(this.sender.id).status, 'ready');
    assert.equal(this.store.assignment(this.supplier.id).status, 'ready');
    assert.deepEqual(this.store.assignment(this.supplier.id).evidence, []);
    const [request] = this.store.inbox(this.sender.id);
    assert.ok(request);
    this.store.respond(this.sender.id, [
      {
        requestId: request.id,
        action: 'require_delivery',
        text: 'The integration now needs verified artifacts',
      },
    ]);
    assert.equal(this.store.assignment(this.sender.id).status, 'waiting');
    assert.equal(this.store.inbox(this.sender.id).length, 1);
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
    this.store.complete(this.supplier.id, ['Verified supplier delivery']);
    assert.equal(this.store.assignment(this.sender.id).status, 'ready');
  }

  /** Creates separate work for an explicit null identity even when the requested owner already has accepted work. */
  distinct(): void {
    const outcome = this.route([this.request(null)]);
    assert.equal(outcome.kind, 'request');
    new Scheduler(this.store, async () => outcome).commit(this.sender.id, outcome);
    const [request] = this.store.inbox(this.sender.id);
    assert.ok(request);
    assert.notEqual(request.assignmentId, this.supplier.id);
    assert.equal(this.store.assignments(this.sender.runId).length, 3);
    const created = this.store.assignment(request.assignmentId);
    assert.equal(created.objective, this.request().request);
    assert.deepEqual(created.acceptance, this.request().acceptanceCriteria);
    assert.equal(created.data.accepted, undefined);
    assert.deepEqual(created.evidence, []);
    assert.equal(this.store.assignment(this.supplier.id).data.accepted, true);
    assert.deepEqual(this.store.assignment(this.sender.id).dependencies, [created.id]);
  }

  /** Requires criteria for distinct work while allowing a link to use its supplier's accepted criteria. */
  criteria(): void {
    const request = { ...this.request(null), acceptanceCriteria: [] };
    assert.equal(this.route([request]).kind, 'continue');
    assert.match(this.record.requestCorrection.errors.join('\n'), /acceptance criteria/i);
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
    assert.deepEqual(this.store.inbox(this.sender.id), []);
    assert.equal(this.route([{ ...request, assignmentId: this.supplier.id }]).kind, 'request');
  }

  /** Rejects a blocking reverse link without mutating assignments or leaving a second inbox request. */
  cycle(): void {
    const outcome = this.route();
    assert.equal(outcome.kind, 'request', 'Canonical supplier link precedes cycle validation');
    const scheduler = new Scheduler(this.store, async () => outcome);
    scheduler.commit(this.sender.id, outcome);
    const request = this.request(this.sender.id, 'a');
    const reverse = (this.execution as any).requests(this.supplier, this.record, [request]);
    assert.equal(reverse.kind, 'request');
    assert.throws(() => scheduler.commit(this.supplier.id, reverse), /Blocking dependency cycle/);
    assert.deepEqual(this.store.assignment(this.supplier.id).dependencies, []);
    assert.deepEqual(this.store.assignment(this.sender.id).dependencies, [this.supplier.id]);
    assert.equal(this.store.inbox(this.sender.id).length, 1);
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
  }

  /** Rejects invalid identities in a mixed batch and retains the entire rejected purpose before dispatch. */
  invalid(): void {
    const foreign = this.store.createRun('task', ['b'], 'Foreign supplier');
    const other = this.store.enqueue(foreign.id, 'b', 'Foreign proof');
    const invalid = [
      this.request('unknown-supplier'),
      this.request(this.supplier.id, 'c'),
      this.request(other.id),
      this.request(this.sender.id, 'a'),
    ];
    for (const request of invalid) {
      const requests = [this.request(null, 'c'), request];
      const outcome = this.route(requests);
      assert.equal(
        outcome.kind,
        'continue',
        'Invalid supplier link is rejected before any dispatch',
      );
      this.rejected(requests, String(request.assignmentId));
    }
  }

  /** Checks persisted rejection diagnostics and proves the valid prefix did not dispatch. */
  private rejected(requests: unknown[], assignmentId: string): void {
    const path = join(this.f.state, 'runs', this.record.id, 'report.json');
    const retained = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(retained.requestCorrection.requests, requests);
    assert.ok(retained.requestCorrection.errors[0].includes(assignmentId));
    assert.deepEqual(this.store.inbox(this.sender.id), []);
    assert.deepEqual(this.store.assignment(this.sender.id).dependencies, []);
    assert.equal(this.store.assignments(this.sender.runId).length, 2);
  }
}

test('runtime links a discovered accepted supplier using different caller purpose and canonical evidence', (t) =>
  new CanonicalSupplierScenario(t).linked());

test('runtime retains invalid supplier evidence before routing any mixed-batch work', (t) =>
  new CanonicalSupplierScenario(t).invalid());

test('runtime strengthens an accepted-intent supplier request without claiming verified delivery', (t) =>
  new CanonicalSupplierScenario(t).accepted());

test('runtime creates distinct requested work when an accepted owner already has another assignment', (t) =>
  new CanonicalSupplierScenario(t).distinct());

test('runtime requires new-work criteria but reuses criteria for explicit supplier links', (t) =>
  new CanonicalSupplierScenario(t).criteria());

test('runtime rejects a cyclic supplier link without partial dependency or inbox mutations', (t) =>
  new CanonicalSupplierScenario(t).cycle());

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
