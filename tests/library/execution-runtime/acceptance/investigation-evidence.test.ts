import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises actual direction, assignment initialization and MCP evidence reads with controlled model inputs. */
class InvestigationEvidenceScenarios {
  /** Director-selected research receives caller clarification and exact retained evidence without host path access. */
  async handoff(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    const run = host.submit('READ_ASSIGNMENT_EVIDENCE: inspect the original checkpoint');
    host.store.updateRun(run.id, 'running', { redirection: 'CALLER_CLARIFICATION: diagnose only' });
    const source = host.store.enqueue(run.id, 'b', 'Existing failed work');
    this.retain(f.state, host, source);
    await host.tick();
    const investigator = host.store.assignments(run.id).find((item) => item.owner === 'a')!;
    assert.equal((investigator.data.directionContext as any).summary, 'Controlled direction');
    await host.tick();
    const trace = JSON.parse(readFileSync(f.calls + '.evidence', 'utf8').trim());
    assert.equal(trace.manifest.runId, run.id);
    assert.equal(trace.manifest.assignmentId, investigator.id);
    assert.equal(trace.artifacts[source.id + ':checkpoint'], '{"original":"OBSERVED_CHECKPOINT"}');
    assert.match(trace.artifacts.direction, /CALLER_CLARIFICATION: diagnose only/);
    assert.equal(JSON.parse(trace.artifacts[source.id + ':edit-index']).evidenceUnavailable, true);
    assert.equal(host.store.assignment(source.id).status, 'failed');
    assert.equal(host.store.assignment(investigator.id).owner, 'a');
  }

  /** Retains an incomplete original record without granting the investigator any continuation authority. */
  private retain(root: string, host: ProjectHost, source: { id: string; runId: string }): void {
    const id = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        id,
        executionRunId: source.runId,
        assignmentId: source.id,
        commands: [],
        safeCheckpoint: false,
        status: 'failed',
      }),
    );
    writeFileSync(join(directory, 'checkpoint.json'), '{"original":"OBSERVED_CHECKPOINT"}');
    host.store.updateAssignment(source.id, 'failed', { recordId: id });
  }
}

const scenarios = new InvestigationEvidenceScenarios();

test('director-selected investigation receives pinned evidence through its production MCP connection', (t) =>
  scenarios.handoff(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'recovery'],
});
