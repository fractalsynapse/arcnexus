import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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
      [],
    );
    await this.assertPublicationBundle(fixture, bundle, input);
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
    const run = store.createRun('task', ['report'], 'Assess the captured candidate');
    return { root, project, store, run };
  }
}

const scenarios = new PublicationInputScenarios();

test('publication bundle preserves caller input through pinned verification pages', (t) =>
  scenarios.publicationBundle(t));

test('missing and foreign caller observations remain explicit gaps', (t) =>
  scenarios.callerObservationGaps(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
