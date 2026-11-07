import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import {
  EvidencePages,
  ExecutionEvidence,
  PublicationEvidence,
} from '../../../../dist/library/report/report.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { LifecycleStore } from '../../../../dist/library/coordination-store/lifecycle-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';

type PublicationFixture = {
  root: string;
  project: string;
  store: ExecutionStore;
  run: ReturnType<ExecutionStore['run']>;
};

/** Checks caller attribution in the production publication projection. */
class PublicationInputScenarios {
  /** Captures a publication bundle and verifies its caller input after pinned page reconstruction. */
  async publicationBundle(t: TestContext): Promise<void> {
    const fixture = this.publicationFixture(t);
    const input =
      'Architect response: command context: npm test -- report\n' +
      'exit status: 7\ncombined output:\ncaller stdout\ncaller stderr\n';
    fixture.store.updateRun(fixture.run.id, fixture.run.status, {
      prompt: input,
      candidateRevision: 'candidate-at-capture',
    });
    const bundle = new PublicationEvidence(fixture.root, fixture.project).capture(
      fixture.run,
      this.publicationRecord(fixture.run),
    );
    await this.assertPublicationBundle(fixture, bundle, input);
  }

  /** A resumed director reads the actual rejected proposal and error through the same pinned evidence. */
  async admissionFailure(t: TestContext): Promise<void> {
    const f = this.publicationFixture(t);
    const decision = {
      continuations: [{ assignmentId: 'prepared', replacementChangeType: 'documentation' }],
    };
    const error = 'Replacement requires a diagnosed assignment of the same owner and run';
    f.store.updateRun(f.run.id, 'needs_attention', { error, directionHistory: [decision] });
    f.store.updateRun(f.run.id, 'running');
    const captured = new ExecutionEvidence(f.root, f.store).capture(f.run.id);
    const pages = new EvidencePages('direction.evidence');
    ExecutionEvidence.pin(f.root, f.run.id, pages, captured);
    f.store.updateRun(f.run.id, 'needs_attention', { error: 'A later observation' });
    const evidence = await this.artifact(pages, 'execution');
    assert.equal(evidence.run.status, 'running');
    assert.equal(evidence.run.retainedError, error);
    assert.deepEqual(evidence.run.latestDirection, decision);
    assert.equal(evidence.run.goalEvidence, undefined);
  }

  /** Original engineering observations survive promotion through the actual shared capability. */
  async provenance(t: TestContext): Promise<void> {
    const f = this.publicationFixture(t);
    const source = this.sourceRecord(f);
    f.store.updateRun(f.run.id, f.run.status, { promotionSourceRun: source.id });
    const run = f.store.run(f.run.id);
    const bundle = new PublicationEvidence(f.root, f.project).capture(
      run,
      this.publicationRecord(run),
    );
    const pages = new EvidencePages('verification.evidence');
    ExecutionEvidence.pin(f.root, run.id, pages, bundle);
    const current = await this.artifact(pages, 'execution');
    const original = await this.artifact(pages, current.provenance.artifact);
    assert.equal(current.run.environment.mode, 'live');
    assert.equal(original.run.environment.mode, 'simulation');
    assert.equal(original.run.id, source.id);
    const record = await this.artifact(pages, original.assignments[0].record.artifact);
    assert.deepEqual(await this.artifact(pages, record.plan.artifact), {
      objective: 'Original design',
    });
    const observations = await this.artifact(pages, record.observations.artifact);
    const commands = await this.artifact(pages, observations.hostCommands.artifact);
    const output = await pages.call('verification.evidence', {
      artifact: commands[0].output.artifact,
    });
    assert.equal((output as any).content, 'Native production regression passed\n');
    const forged = structuredClone(bundle) as any;
    forged.provenance.run.id = randomUUID();
    assert.throws(() => ExecutionEvidence.pin(f.root, run.id, pages, forged), /captured source/);
  }

  /** Retains an explicit simulation assignment with its original plan and observed command bytes. */
  private sourceRecord(f: PublicationFixture) {
    const source = f.store.createRun('task', ['report'], 'Original engineering', {
      id: 'sim',
      mode: 'simulation',
    });
    const assignment = f.store.enqueue(source.id, 'report', 'Implement change', ['Native proof']);
    const id = randomUUID();
    const directory = join(f.root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    const log = join(directory, 'command.log');
    writeFileSync(log, 'Native production regression passed\n');
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        id,
        executionRunId: source.id,
        assignmentId: assignment.id,
        plan: { objective: 'Original design' },
        status: 'completed',
        commands: [{ command: 'node', args: ['--test', 'native.test.js'], exitCode: 0, log }],
      }),
    );
    f.store.updateAssignment(assignment.id, 'prepared', { recordId: id });
    return source;
  }

  /** Reconstructs one advertised JSON artifact through the production page boundary. */
  private async artifact(pages: EvidencePages, id: string): Promise<any> {
    const metadata = pages.metadata().find((artifact) => artifact.id === id)!;
    return JSON.parse(await this.readVerificationArtifact(pages, id, metadata.totalCharacters));
  }

  /** Gives the production publication projection its required independently checked record identity. */
  private publicationRecord(run: PublicationFixture['run']): RecordData {
    return {
      id: randomUUID(),
      executionRunId: run.id,
      executionEnvironment: run.environment,
      activationRole: 'publication-checks',
      base: 'candidate-head',
      commands: [],
    } as unknown as RecordData;
  }

  /** Pages the production publication projection and verifies exact attribution and candidate context. */
  private async assertPublicationBundle(
    fixture: PublicationFixture,
    bundle: unknown,
    input: string,
  ): Promise<void> {
    const pages = new EvidencePages('verification.evidence');
    pages.add('publication', JSON.stringify(bundle), 'json');
    const metadata = pages.metadata().find((artifact) => artifact.id === 'publication')!;
    const content = await this.readVerificationArtifact(
      pages,
      'publication',
      metadata.totalCharacters,
    );
    this.assertCallerEvidence(JSON.parse(content), fixture.run.id, input);
    await this.assertExactEnd(pages, metadata.totalCharacters);
  }

  /** Keeps caller input separate from host results and candidate qualification evidence. */
  private assertCallerEvidence(evidence: any, runId: string, input: string): void {
    assert.deepEqual(evidence.run.callerObservations, {
      attribution: 'caller-provided',
      runId,
      input,
    });
    assert.equal(evidence.run.id, runId);
    assert.equal(evidence.run.candidateRevision, 'candidate-at-capture');
    assert.equal(evidence.publication.head, 'candidate-head');
    assert.equal(evidence.run.verifiedEvidence, undefined);
    assert.equal(evidence.run.goalEvidence, undefined);
  }

  /** Confirms an exact-end character offset yields an empty terminal page without a continuation. */
  private async assertExactEnd(pages: EvidencePages, totalCharacters: number): Promise<void> {
    const page = (await pages.call('verification.evidence', {
      artifact: 'publication',
      offset: totalCharacters,
      length: 1,
    })) as any;
    assert.equal(page.artifact, 'publication');
    assert.equal(page.offset, totalCharacters);
    assert.equal(page.content, '');
    assert.equal(page.complete, true);
    assert.equal(page.nextOffset, null);
  }

  /** Reassembles pinned verification pages and preserves their artifact identity and hash. */
  private async readVerificationArtifact(
    pages: EvidencePages,
    artifact: string,
    totalCharacters: number,
  ): Promise<string> {
    let offset = 0;
    let content = '';
    let identity: string | undefined;
    while (true) {
      const page = (await pages.call('verification.evidence', {
        artifact,
        offset,
        length: 257,
      })) as any;
      identity ??= page.sha256;
      assert.equal(page.artifact, artifact);
      assert.equal(page.sha256, identity);
      assert.equal(page.totalCharacters, totalCharacters);
      content += page.content;
      if (page.complete) {
        assert.equal(page.nextOffset, null);
        break;
      }
      offset = page.nextOffset;
    }
    return content;
  }

  /** Missing prompt data and another run's prompt remain explicit gaps for this run. */
  callerObservationGaps(t: TestContext): void {
    const missing = this.publicationFixture(t);
    const missingEvidence = new ExecutionEvidence(missing.root, missing.store).capture(
      missing.run.id,
    );
    assert.deepEqual((missingEvidence.run as Record<string, unknown>).callerObservations, {
      evidenceUnavailable: true,
      reason: 'Caller observations were not retained for this run',
    });

    const foreign = this.publicationFixture(t);
    const otherRun = foreign.store.createRun('task', ['report'], 'Foreign prompt');
    foreign.store.updateRun(otherRun.id, otherRun.status, { prompt: 'FOREIGN caller input' });
    const foreignEvidence = new ExecutionEvidence(foreign.root, foreign.store).capture(
      foreign.run.id,
    );
    assert.deepEqual((foreignEvidence.run as Record<string, unknown>).callerObservations, {
      evidenceUnavailable: true,
      reason: 'Caller observations were not retained for this run',
    });
    assert.doesNotMatch(JSON.stringify(foreignEvidence), /FOREIGN caller input/);
  }

  /** Builds a temporary durable run store for the production publication evidence constructor. */
  private publicationFixture(t: TestContext): PublicationFixture {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-publication-evidence-'));
    const project = 'report-evidence';
    const directory = join(root, 'projects', project);
    mkdirSync(directory, { recursive: true });
    const store = new ExecutionStore(join(directory, 'execution.sqlite'));
    t.after(() => {
      try {
        store.close();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
    const lifecycle = new LifecycleStore(join(directory, 'lifecycle.sqlite'));
    lifecycle.close();
    const run = store.createRun('task', ['report'], 'Assess the captured candidate', {
      id: 'live',
      mode: 'live',
    });
    return { root, project, store, run };
  }
}

const scenarios = new PublicationInputScenarios();

test('publication bundle preserves caller input through pinned verification pages', (t) =>
  scenarios.publicationBundle(t));

test('missing and foreign caller observations remain explicit gaps', (t) =>
  scenarios.callerObservationGaps(t));

test('publication exposes original promotion observations without changing their attribution', (t) =>
  scenarios.provenance(t));

test('canonical direction evidence retains rejected proposals and errors across resume', (t) =>
  scenarios.admissionFailure(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
