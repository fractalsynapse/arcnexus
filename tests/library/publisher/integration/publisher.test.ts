import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import type {
  ExecutionRun,
  ExecutionAssignment,
} from '../../../../dist/library/coordination-store/execution-types.js';
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
    this.run.data.goalEvidence = [this.review('director-assessment')];
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
        executionRunId: 'run',
        assignmentId: 'assignment',
        activationRole: role,
        status: 'completed',
        executionEnvironment: this.run.environment,
        acceptanceCriteria: ['Updated source'],
        verificationEvidence: {
          candidateDigest: candidateDigest(this.record),
          baseline: this.record.base,
        },
        agent: this.assessment(),
      }),
    );
    return path;
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
}

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

test('publisher rejects source changes after independent review', (t) => {
  const f = new PublisherFixture(t);
  writeFileSync(join(f.source, 'source.txt'), 'unreviewed');
  assert.throws(() => f.capture(), /changed after verified delivery/);
  assert.deepEqual(f.store.list(), []);
});

test('publisher refuses missing goal evidence and unfinished assignments', (t) => {
  const f = new PublisherFixture(t);
  f.assignment.status = 'blocked';
  assert.throws(() => f.capture(), /unfinished/);
  f.assignment.status = 'completed';
  f.run.data.goalEvidence = [];
  assert.throws(() => f.capture(), /goal assessment/);
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

registerSuite({
  component: 'publisher',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
