import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { DeliveryEvidence } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Keeps worker continuation payloads independent of the volume of retained command observations. */
class DeliveryContextScenarios {
  /** Compact context preserves complete criteria while full verification still receives actual output. */
  projection(t: TestContext): void {
    const { root, assignment, report, output, path } = this.fixture(t);
    const reader: any = new DeliveryEvidence(root);
    const summary = reader.capture(assignment, false)[0];
    assert.ok(JSON.stringify(summary).length < 10000);
    assert.deepEqual(summary.assessment, report.agent);
    assert.equal(summary.reviewedCandidate.candidateDigest, 'reviewed-by-host');
    assert.equal(summary.observations.retainedIn, 'independent-verifier-report');
    assert.equal(summary.recordId, report.id);
    const full = reader.capture(assignment)[0];
    assert.equal(full.observations.hostCommands[0].output.content, output);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), report);
  }

  /** Captures a valid independent review whose observed tool output exceeds native prompt transport. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-delivery-context-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const id = randomUUID(),
      parent = randomUUID(),
      run = randomUUID(),
      assignmentId = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    const log = join(directory, 'check.log');
    const output = 'retained observation\n'.repeat(100000);
    writeFileSync(log, output);
    const report = this.review(id, run, assignmentId, parent, log);
    const path = join(directory, 'report.json');
    writeFileSync(path, JSON.stringify(report));
    const assignment = {
      id: assignmentId,
      runId: run,
      owner: 'supplier',
      objective: 'Supply',
      acceptance: ['Observed'],
      status: 'completed',
      dependencies: [],
      evidence: [path],
      data: { recordId: parent },
    };
    return { root, assignment, report, output, path };
  }

  /** Constructs the independent assessment identity separately from its large observation artifact. */
  private review(id: string, run: string, assignmentId: string, parent: string, log: string) {
    return {
      id,
      executionRunId: run,
      assignmentId,
      parentRecordId: parent,
      activationRole: 'verifier',
      status: 'completed',
      commands: [{ command: 'node', args: [], exitCode: 0, log }],
      verificationEvidence: { candidateDigest: 'reviewed-by-host', baseline: 'base', changes: [] },
      agent: {
        status: 'completed',
        criteria: [{ index: 0, verdict: 'verified', evidence: ['Observed check output'] }],
      },
    };
  }
}

const scenarios = new DeliveryContextScenarios();

test('dependency context preserves assessments without embedding large retained observations', (t) =>
  scenarios.projection(t));

registerSuite({ component: 'report', level: 'acceptance', tags: ['deterministic'] });
