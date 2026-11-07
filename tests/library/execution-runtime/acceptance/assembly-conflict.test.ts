import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { AssembledDelivery } from '../../../../dist/library/execution-runtime/assembled-delivery.js';
import { AssignmentDispatch } from '../../../../dist/library/execution-runtime/assignment-dispatch.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { AssemblyFixture } from '../support/assembly-fixture.js';

/** Exercises conflicting prepared source through the ordinary rejection and director continuation boundary. */
class AssemblyConflictScenario {
  /** Retains both versions and the owner without creating a check record or promoting a failed assembly. */
  async rejects(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t, 'task');
    await f.prepare(f.implementation, 'source.txt', 'contribution');
    await f.prepare(f.regression, 'b/regression.cjs', '// retained peer');
    const base = this.advanceBase(f);
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    assert.equal(
      await assembly.advance(f.host.store.run(f.run.id), new AbortController().signal),
      false,
    );
    const run = f.host.store.run(f.run.id);
    const rejected = run.data.lastAssembly as {
      conflict: { assignmentId: string; owner: string; evidence: string };
      recordId?: string;
    };
    assert.equal(run.status, 'running');
    assert.equal(run.data.candidateRevision, base);
    assert.equal(run.data.pendingAssembly, undefined);
    assert.equal(rejected.recordId, undefined);
    assert.equal(rejected.conflict.assignmentId, f.implementation.id);
    assert.equal(rejected.conflict.owner, 'a');
    assert.match(readFileSync(rejected.conflict.evidence, 'utf8'), /source.txt/);
    assert.equal(assembly.ready(run), false);
    assert.equal(await assembly.advance(run, new AbortController().signal), false);
    this.continueOwner(f);
  }

  /** Models a newer verified baseline without altering either prepared contribution. */
  private advanceBase(f: AssemblyFixture): string {
    const path = join(f.fixture.repo, 'source.txt');
    const original = readFileSync(path);
    writeFileSync(path, 'new baseline');
    const base = new CandidateSnapshots(f.fixture.repo, join(f.fixture.state, 'snapshots')).capture(
      f.fixture.repo,
      f.context.base,
    );
    writeFileSync(path, original);
    f.host.store.updateRun(f.run.id, 'running', { candidateRevision: base });
    return base;
  }

  /** Uses the existing director contract to resume only the conflicting owner and retain its peer. */
  private continueOwner(f: AssemblyFixture): void {
    const peer = f.host.store.assignment(f.regression.id);
    new AssignmentDispatch(f.fixture.state, f.context, f.host.store).apply(
      f.host.store.run(f.run.id),
      {
        status: 'ready',
        summary: 'Resolve retained source conflict',
        selectedOwners: [],
        rejectedOwners: [],
        questions: [],
        assignments: [],
        dependency: null,
        architectureProposal: null,
        dependencyRetirementProposal: null,
        continuations: [
          {
            assignmentId: f.implementation.id,
            ownerId: 'a',
            reason: 'Resolve owned source conflict',
          },
        ],
      },
    );
    assert.equal(f.host.store.assignment(f.implementation.id).status, 'ready');
    assert.deepEqual(f.host.store.assignment(f.regression.id), peer);
  }
}

test('assembly conflicts return to ordinary owner correction without verification or blind retry', (t) =>
  new AssemblyConflictScenario().rejects(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
