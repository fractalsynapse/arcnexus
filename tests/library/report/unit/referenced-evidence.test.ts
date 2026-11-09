import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EvidenceSet, ReferencedEvidence } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises exact evidence retrieval and origin validation without granting filesystem access. */
class ReferencedEvidenceScenarios {
  /** Reusing an already observed record cannot attach its proof to another assignment in the same capture. */
  rebound(t: TestContext): void {
    const f = this.fixture(t);
    const foreign = structuredClone(f.evidence.assignments[0]!);
    foreign.id = 'foreign';
    f.evidence.assignments.push(foreign);
    assert.throws(() => f.reader.index(f.evidence), /different assignment/);
  }

  /** A later capture revalidates identity instead of retaining an earlier report's authorization. */
  recapture(t: TestContext): void {
    const f = this.fixture(t);
    f.reader.index(f.evidence);
    writeFileSync(
      join(f.directory, 'report.json'),
      JSON.stringify({
        id: f.id,
        executionRunId: 'foreign',
        assignmentId: 'assignment',
      }),
    );
    assert.throws(() => f.reader.index(f.evidence), /different run/);
  }

  /** Retains repeated observations as one exact artifact and leaves verification snapshots unexpanded. */
  async observed(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const events = f.evidence.assignments[0]!.record.observations.timeline.events;
    events.push(structuredClone(events[0]!));
    const historical = structuredClone(events[0]!);
    historical.payload.item.tool = 'verification.evidence';
    events.push(historical);
    f.reader.index(f.evidence);
    const result = events[0]!.payload.item.result;
    const page = (await f.pages.call('verification.evidence', {
      artifact: result.verificationArtifact,
    })) as any;
    assert.equal(page.content, f.content);
    assert.equal(page.sha256, f.hash);
    assert.equal(f.pages.metadata().length, 1);
    assert.equal(historical.payload.item.result.verificationArtifact, undefined);
    assert.equal(result.artifact, 'supplier:edit:receipt.json');
  }

  /** Missing bytes remain explicit gaps and never become fabricated successful evidence. */
  missing(t: TestContext): void {
    const f = this.fixture(t);
    rmSync(f.path);
    f.reader.index(f.evidence);
    const result =
      f.evidence.assignments[0]!.record.observations.timeline.events[0]!.payload.item.result;
    assert.equal(result.evidenceUnavailable, true);
    assert.equal(result.verificationArtifact, undefined);
    assert.equal(f.pages.metadata().length, 0);
  }

  /** Foreign identities, changed content and aliased files fail before artifacts can be advertised. */
  unsafe(t: TestContext, kind: string): void {
    const f = this.fixture(t);
    if (kind === 'foreign' || kind === 'assignment') {
      writeFileSync(
        join(f.directory, 'report.json'),
        JSON.stringify({
          id: f.id,
          executionRunId: kind === 'foreign' ? 'foreign' : 'current-run',
          assignmentId: kind === 'assignment' ? 'foreign' : 'assignment',
        }),
      );
    } else if (kind === 'hash') writeFileSync(f.path, 'different bytes');
    else {
      rmSync(f.path);
      const target = join(f.directory, 'aliased');
      writeFileSync(target, f.content);
      if (kind === 'symlink') symlinkSync(target, f.path);
      else linkSync(target, f.path);
    }
    assert.throws(() => f.reader.index(f.evidence), /different run|content identity|Unsafe/);
    assert.equal(f.pages.metadata().length, 0);
  }

  /** Creates private same-run artifacts using the production content-addressed layout. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-referenced-evidence-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const id = '11111111-1111-4111-8111-111111111111';
    const directory = join(root, 'runs', id);
    mkdirSync(join(directory, 'assignment-evidence'), { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        id,
        executionRunId: 'current-run',
        assignmentId: 'assignment',
      }),
    );
    const content = '{"transaction":"observed","status":"committed"}';
    const hash = createHash('sha256').update(content).digest('hex');
    const path = join(directory, 'assignment-evidence', hash);
    writeFileSync(path, content);
    const pages = new EvidenceSet('verification.evidence', directory);
    return {
      id,
      directory,
      content,
      hash,
      path,
      pages,
      reader: new ReferencedEvidence(root, 'current-run', pages),
      evidence: this.evidence(id, hash),
    };
  }

  /** Represents a host-observed completed investigation page, not a caller-selected artifact path. */
  private evidence(id: string, hash: string) {
    const result: any = {
      contentRetainedInPinnedArtifact: true,
      artifact: 'supplier:edit:receipt.json',
      sha256: hash,
    };
    const event = {
      runId: id,
      type: 'codex.event',
      payload: {
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          server: 'arcnexus',
          tool: 'assignment.evidence',
          result,
        },
      },
    };
    return {
      assignments: [
        {
          id: 'assignment',
          record: { recordId: id, observations: { timeline: { events: [event] } } },
        },
      ],
    };
  }
}

const scenarios = new ReferencedEvidenceScenarios();

test('observed record identity cannot be rebound within one evidence capture', (t) =>
  scenarios.rebound(t));

test('subsequent evidence captures revalidate originating record identity', (t) =>
  scenarios.recapture(t));

test('observed investigation artifacts are exact, deduplicated and nonrecursive', (t) =>
  scenarios.observed(t));

test('missing investigation content remains an explicit evidence gap', (t) => scenarios.missing(t));

for (const kind of ['foreign', 'assignment', 'hash', 'symlink', 'hardlink'])
  test('investigation references reject ' + kind, (t) => scenarios.unsafe(t, kind));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
