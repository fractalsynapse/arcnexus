import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { ExecutionEvidence, RecoveryEvidence } from '../../../../dist/library/report/report.js';
import { DirectionContext } from '../../../../dist/library/task-intake/direction-context.js';
import { VerificationEvidence } from '../../../../dist/library/task-intake/verification-evidence.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

const callerInput = 'Caller command: node check.js\nExit: 7\nstdout: observed\nstderr: failure\n';

/** Exercises one actual store capture through each production model-facing evidence consumer. */
class ExecutionContextScenarios {
  /** Preserves real retained caller input through the independent verifier's advertised paged artifact. */
  async verification(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    try {
      const record = this.record(f);
      const adapter = new VerificationEvidence(f.state, record, record.base, {
        criteria: ['scope'],
      });
      const bridge = adapter.wrap(this.operations());
      const manifest = await this.page(bridge, 'verification.evidence', 'manifest');
      assert.ok(manifest.artifacts.some((item: any) => item.id === 'execution'));
      assert.ok(
        manifest.artifacts.some((item: any) => item.id === 'execution-caller-observations'),
      );
      assert.equal(manifest.candidateDigest, adapter.candidate);
      const execution = await this.execution(bridge, 'verification.evidence');
      this.assertInput(execution, f.run.id, record.base);
      assert.equal(execution.agent, undefined);
      assert.equal(execution.run.verifiedEvidence, undefined);
    } finally {
      f.store.close();
    }
  }

  /** Supplies exact request identities for unstarted suppliers through normal direction evidence. */
  async direction(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    try {
      const record = this.record(f);
      const context = new DirectionContext(f.state, record, [], {
        purpose: 'Diagnose current work',
        state: f.store.assignments(f.run.id),
        feedback: null,
      });
      const bridge = context.wrap(this.operations());
      const execution = await this.execution(bridge, 'direction.evidence');
      this.assertInput(execution, f.run.id, record.base);
      const requests = await this.page(bridge, 'direction.evidence', execution.requests.artifact);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].id, f.request.id);
      assert.equal(requests[0].from, f.sender.id);
      assert.equal(requests[0].assignmentId, f.recipient.id);
      assert.notEqual(requests[0].id, f.recipient.id);
    } finally {
      f.store.close();
    }
  }

  /** Engineering and investigation use the same captured input and correlated request artifacts. */
  async stewardship(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    try {
      const pages = new RecoveryEvidence(f.state, f.store).capture(f.recipient);
      const execution = await this.execution(pages, 'assignment.evidence');
      this.assertInput(execution, f.run.id, f.git('rev-parse', 'HEAD'));
      const requests = await this.page(pages, 'assignment.evidence', execution.requests.artifact);
      assert.equal(requests[0].id, f.request.id);
    } finally {
      f.store.close();
    }
  }

  /** A foreign run cannot enter any consumer; missing caller input remains an explicit gap. */
  async boundaries(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    try {
      f.store.updateRun(f.run.id, f.run.status, { prompt: undefined });
      const record = this.record(f);
      const verifier = new VerificationEvidence(f.state, record, record.base).wrap(
        this.operations(),
      );
      const execution = await this.execution(verifier, 'verification.evidence');
      assert.equal(execution.run.callerObservations.evidenceUnavailable, true);
      assert.doesNotMatch(JSON.stringify(record.hostExecutionEvidence), /FOREIGN_SECRET/);
      record.executionRunId = 'foreign';
      assert.throws(() => new VerificationEvidence(f.state, record, record.base), /different run/);
      assert.throws(() => new DirectionContext(f.state, record, []), /different run/);
      assert.throws(
        () =>
          new RecoveryEvidence(f.state, f.store).capture({
            ...f.recipient,
            runId: 'foreign',
          }),
        /identity/,
      );
    } finally {
      f.store.close();
    }
  }

  /** Retains caller input and a real correlated request in the same store used by production capture. */
  private fixture(t: TestContext) {
    const f = workflowFixture(t);
    const store = new ExecutionStore(join(f.state, 'execution.sqlite'));
    const run = store.createRun('task', ['a', 'b'], 'Original goal');
    store.updateRun(run.id, run.status, {
      prompt: callerInput,
      candidateRevision: f.git('rev-parse', 'HEAD'),
      authorityBase: 'captured',
    });
    const sender = store.enqueue(run.id, 'a', 'Use supplied result');
    const recipient = store.request(sender.id, {
      key: 'request',
      owner: 'b',
      objective: 'Provide evidence',
      acceptance: ['Observed result'],
    });
    const request = store.inbox(sender.id)[0]!;
    const foreign = store.createRun('task', ['a'], 'Unrelated');
    store.updateRun(foreign.id, foreign.status, { prompt: 'FOREIGN_SECRET' });
    return { ...f, store, run, sender, recipient, request };
  }

  /** Builds a candidate record from the real capture, never a hand-authored evidence subset. */
  private record(f: ReturnType<ExecutionContextScenarios['fixture']>): any {
    const id = 'candidate-record';
    mkdirSync(join(f.state, 'runs', id), { recursive: true });
    return {
      id,
      workspace: f.repo,
      base: f.git('rev-parse', 'HEAD'),
      executionRunId: f.run.id,
      hostExecutionEvidence: new ExecutionEvidence(f.state, f.store).capture(f.run.id),
      agent: { claims: ['Unverified worker claim'] },
    };
  }

  /** Confirms exact retained bytes and provenance without promoting caller claims into acceptance. */
  private assertInput(execution: any, runId: string, candidate: string): void {
    assert.deepEqual(execution.run.callerObservations, {
      attribution: 'caller-provided',
      runId,
      input: callerInput,
    });
    assert.equal(execution.run.id, runId);
    assert.equal(execution.run.candidateRevision, candidate);
    assert.equal(execution.run.authorityBase, 'captured');
    assert.equal(execution.run.objective, 'Original goal');
  }

  /** Follows the explicit caller page while checking that execution does not duplicate its input. */
  private async execution(bridge: any, tool: string): Promise<any> {
    const execution = await this.page(bridge, tool, 'execution');
    assert.deepEqual(execution.run.callerObservations, {
      artifact: 'execution-caller-observations',
    });
    assert.doesNotMatch(JSON.stringify(execution), /Caller command: node check/);
    execution.run.callerObservations = await this.page(
      bridge,
      tool,
      execution.run.callerObservations.artifact,
    );
    return execution;
  }

  /** Reads only advertised artifact names through the production capability's continuation contract. */
  private async page(bridge: any, tool: string, artifact: string): Promise<any> {
    let offset = 0;
    let content = '';
    let hash: string | undefined;
    while (true) {
      const result = await bridge.call(tool, { artifact, offset, length: 257 });
      hash ??= result.sha256;
      assert.equal(result.sha256, hash);
      assert.equal(result.artifact, artifact);
      content += result.content;
      if (result.complete) {
        assert.equal(result.nextOffset, null);
        return JSON.parse(content);
      }
      assert.ok(result.nextOffset > offset);
      offset = result.nextOffset;
    }
  }

  /** Leaves model operations unused while exercising the real evidence wrappers. */
  private operations(): any {
    return {
      tools: [],
      call: async () => {
        throw new Error('Unexpected operation');
      },
      disconnect: () => {},
      close: async () => {},
    };
  }
}

const scenarios = new ExecutionContextScenarios();

test('retained caller input crosses production capture and independent verification', (t) =>
  scenarios.verification(t));

test('director retrieves correlated request identities for unstarted suppliers', (t) =>
  scenarios.direction(t));

test('shared assignment capability consumes canonical execution facts', (t) =>
  scenarios.stewardship(t));

test('canonical consumers refuse foreign identities and retain missing-input gaps', (t) =>
  scenarios.boundaries(t));

registerSuite({
  component: 'task-intake',
  level: 'acceptance',
  tags: ['deterministic', 'evidence'],
});
