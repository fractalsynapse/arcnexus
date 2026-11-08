import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import type {
  ExecutionRun,
  ExecutionAssignment,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { save } from '../../../../dist/library/workspace/state.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Supplies explicit controlled review records while exercising real Git snapshots and durable delivery capture. */
class PublisherFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-publisher-'));

  readonly source = join(this.root, 'source');

  readonly store = new DeliveryStore(join(this.root, 'deliveries.sqlite'));

  readonly publisher = new Publisher(this.root, this.store);

  readonly record: RecordData;

  readonly run: ExecutionRun;

  readonly assignment: ExecutionAssignment;

  /** Creates real candidate changes and labels all model evidence as deterministic fixture input. */
  constructor(t: TestContext) {
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
    const base = this.repository();
    this.record = this.candidate(base);
    const candidate = new CandidateSnapshots(this.source, join(this.root, 'snapshots')).capture(
      this.source,
      base,
    );
    this.run = this.execution(base, candidate);
    this.assignment = {
      id: 'assignment',
      runId: 'run',
      owner: 'owner',
      objective: 'Update source',
      acceptance: ['Updated source'],
      status: 'completed',
      dependencies: [],
      evidence: [this.review('verifier')],
      data: { recordId: this.record.id, deliveredRevision: candidate },
    };
    this.run.data.goalEvidence = undefined;
    this.verdictOnCandidate();
    mkdirSync(join(this.root, 'runs', this.record.id), { recursive: true });
    save(this.root, this.record);
  }

  /** Creates a committed baseline and actual uncommitted source changes in private test storage. */
  private repository(): string {
    mkdirSync(this.source);
    git(this.source, 'init', '-q');
    writeFileSync(join(this.source, 'source.txt'), 'before');
    git(this.source, 'add', '.');
    git(
      this.source,
      '-c',
      'user.name=Acceptance',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'baseline',
    );
    const base = git(this.source, 'rev-parse', 'HEAD').trim();
    writeFileSync(join(this.source, 'source.txt'), 'after');
    return base;
  }

  /** Pins controlled run metadata to the real source and candidate objects. */
  private execution(base: string, candidate: string): ExecutionRun {
    return {
      id: 'run',
      mode: 'task',
      environment: { id: 'sim', mode: 'simulation' },
      owners: ['owner'],
      objective: 'Update source',
      status: 'completed',
      createdAt: 'fixture',
      data: {
        candidateRevision: candidate,
        candidateRecord: this.record,
        authorityBase: base,
        packageId: 'package',
        executionIdentity: 'authority',
      },
    };
  }

  /** Retains the actual candidate identity independently of controlled reviewer content. */
  private candidate(base: string): RecordData {
    return {
      id: randomUUID(),
      source: this.source,
      workspace: this.source,
      commonDir: join(this.source, '.git'),
      base,
      branch: '',
      status: 'completed',
      startedAt: 'fixture',
      commands: [],
      environment: { schemaVersion: 4, prerequisites: [], setup: [], generatedDirectories: [] },
      executionRunId: 'run',
      executionEnvironment: { id: 'sim', mode: 'simulation' },
      assignmentId: 'assignment',
    };
  }

  /** Writes synthetic assessments only inside acceptance; no real-agent qualification is asserted. */
  private review(role: string): string {
    const id = randomUUID();
    const directory = join(this.root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'report.json');
    writeFileSync(
      path,
      JSON.stringify({
        id,
        parentRecordId: this.record.id,
        base: this.record.base,
        assemblyAssignments: this.record.assemblyAssignments,
        executionRunId: 'run',
        assignmentId: 'assignment',
        activationRole: role,
        status: 'completed',
        executionEnvironment: this.run.environment,
        acceptanceCriteria: ['Updated source'],
        verificationEvidence: {
          candidateDigest: candidateDigest(this.record),
          baseline: this.record.assemblyBase ?? this.record.base,
        },
        agent: this.assessment(),
      }),
    );
    return path;
  }

  /** Records the one independent assembled verdict that publication attests to. */
  protected verdictOnCandidate(): void {
    (this.record as any).verdict = {
      key: 'fixture-inputs',
      digest: candidateDigest(this.record),
      independent: true,
      result: {
        status: 'passed',
        evidence: [join(this.root, 'runs', String(this.record.id), 'report.json')],
        artifacts: [],
      },
    };
  }

  /** Supplies a complete synthetic criterion assessment at the model boundary. */
  private assessment() {
    return {
      status: 'completed',
      summary: 'Controlled review',
      deficiencies: [],
      criteria: [
        {
          index: 0,
          verdict: 'verified',
          evidence: ['Controlled test evidence'],
          explanation: 'Fixture',
        },
      ],
    };
  }

  /** Exercises the public capture service with a host-supplied target, without executing publication. */
  capture() {
    return this.publisher.capture('project', this.run, [this.assignment], {
      repository: 'owner/repo',
      branch: 'staging',
    });
  }

  /** Reproduces the host's assembled checkout while retaining its distinct engineering parent. */
  assemble(): string {
    const base = this.record.base;
    const head = String(this.run.data.candidateRevision);
    git(this.source, 'reset', '--hard', head);
    this.record.base = head;
    this.record.assemblyBase = base;
    this.record.assemblyAssignments = [
      {
        id: this.assignment.id,
        owner: this.assignment.owner,
        recordId: this.record.id,
        acceptance: this.assignment.acceptance,
      },
    ];
    this.run.data.authorityBase = head;
    this.assignment.data.deliveryRecordId = this.record.id;
    this.assignment.evidence = [this.review('verifier')];
    this.verdictOnCandidate();
    save(this.root, this.record);
    return base;
  }

  /** Removes the recorded verdict and retains the candidate, as a candidate that was never gated. */
  dropVerdict(): void {
    delete (this.record as any).verdict;
    save(this.root, this.record);
  }
}

test('assembled publication retains the reviewed engineering parent, not authority or checkout', (t) => {
  const f = new PublisherFixture(t);
  const base = f.assemble();
  const delivery = f.capture();
  assert.equal(delivery.base, base);
  assert.notEqual(delivery.base, f.record.base);
  assert.notEqual(delivery.base, f.run.data.authorityBase);
  assert.equal(delivery.developments, undefined);
  assert.deepEqual(f.capture(), delivery);
  assert.equal(f.publisher.resolveRetained(delivery, f.run, [f.assignment]).id, f.record.id);
  f.record.assemblyBase = f.record.base;
  assert.throws(() => f.capture(), /differs from independent acceptance/);
});

test('publisher captures actual reviewed changes once without publishing or approving', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  assert.deepEqual(f.capture(), delivery);
  assert.equal(delivery.candidate, f.run.data.candidateRevision);
  assert.equal(delivery.approval, undefined);
  assert.equal(delivery.delivery, 'retained');
  assert.equal(delivery.integration, 'not_requested');
  assert.equal(f.store.list().length, 1);
});

test('historical delivery capture preserves original publication intent on recovery', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  assert.match(delivery.publicationDocument!.body, new RegExp(delivery.candidate));
  const historicalStore = new DeliveryStore(join(f.root, 'historical.sqlite'));
  t.after(() => historicalStore.close());
  const historical = { ...delivery };
  delete historical.publicationDocument;
  historicalStore.capture(historical);
  const recovered = new Publisher(f.root, historicalStore).capture(
    'project',
    f.run,
    [f.assignment],
    delivery.target,
  );
  assert.equal(recovered.publicationDocument, undefined);
  assert.equal(recovered.candidate, delivery.candidate);
});

test('publisher rejects source changes after independent review', (t) => {
  const f = new PublisherFixture(t);
  writeFileSync(join(f.source, 'source.txt'), 'unreviewed');
  assert.throws(() => f.capture(), /changed after verified delivery/);
  assert.deepEqual(f.store.list(), []);
});

test('publisher refuses a candidate without its verdict and unfinished assignments', (t) => {
  const f = new PublisherFixture(t);
  f.assignment.status = 'blocked';
  assert.throws(() => f.capture(), /unfinished/);
  f.assignment.status = 'completed';
  f.dropVerdict();
  assert.throws(() => f.capture(), /independent assembled verdict/);
  assert.deepEqual(f.store.list(), []);
});

test('retained delivery proof survives a newer candidate pointer and supports historical record metadata', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  assert.equal(delivery.candidateRecordId, f.record.id);
  f.run.data.candidateRevision = f.record.base;
  f.publisher.revalidate(delivery, f.run, [f.assignment], f.record);
  const historical = { ...delivery };
  delete historical.candidateRecordId;
  f.publisher.revalidate(historical, f.run, [f.assignment], f.record);
  assert.deepEqual(f.store.get(delivery.id), delivery);
});

test('retained delivery proof rejects revised review content even when they still claim success', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  const path = f.assignment.evidence[0]!;
  const review = JSON.parse(readFileSync(path, 'utf8'));
  review.agent.summary = 'Rewritten after acceptance';
  writeFileSync(path, JSON.stringify(review));
  assert.throws(
    () => f.publisher.revalidate(delivery, f.run, [f.assignment], f.record),
    /evidence changed/,
  );
});

test('retained delivery proof rejects substituted source authority, record and assignment attribution', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  assert.throws(() => f.publisher.revalidate(delivery, f.run, [], f.record), /attribution/);
  assert.throws(
    () =>
      f.publisher.revalidate(
        { ...delivery, candidateRecordId: 'foreign' },
        f.run,
        [f.assignment],
        f.record,
      ),
    /attribution/,
  );
  assert.throws(
    () =>
      f.publisher.revalidate(
        { ...delivery, authorityDigest: 'foreign' },
        f.run,
        [f.assignment],
        f.record,
      ),
    /attribution/,
  );
  writeFileSync(join(f.source, 'source.txt'), 'unreviewed after capture');
  assert.throws(
    () => f.publisher.revalidate(delivery, f.run, [f.assignment], f.record),
    /changed after verified/,
  );
});

test('retained candidate resolution uses verified historical receipts instead of the latest run pointer', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  f.run.data.candidateRecord = { id: 'newer-candidate' };
  f.run.data.candidateRevision = f.record.base;
  assert.deepEqual(f.publisher.resolveRetained(delivery, f.run, [f.assignment]), f.record);
  const historical = { ...delivery };
  delete historical.candidateRecordId;
  assert.deepEqual(f.publisher.resolveRetained(historical, f.run, [f.assignment]), f.record);
});

test('retained candidate resolution rejects missing, aliased and substituted receipts', (t) => {
  const f = new PublisherFixture(t);
  const delivery = f.capture();
  const path = join(f.root, 'runs', f.record.id, 'report.json');
  rmSync(path);
  assert.throws(() => f.publisher.resolveRetained(delivery, f.run, [f.assignment]), /unavailable/);
  const alternate = join(f.root, 'alternate.json');
  writeFileSync(alternate, JSON.stringify(f.record));
  symlinkSync(alternate, path);
  assert.throws(() => f.publisher.resolveRetained(delivery, f.run, [f.assignment]), /Unsafe/);
  rmSync(path);
  writeFileSync(path, JSON.stringify({ ...f.record, id: randomUUID() }));
  assert.throws(
    () => f.publisher.resolveRetained(delivery, f.run, [f.assignment]),
    /identity mismatch/,
  );
});

registerSuite({
  component: 'publisher',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
