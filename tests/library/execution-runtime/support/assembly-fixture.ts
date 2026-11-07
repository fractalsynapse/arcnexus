import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  ExecutionContext,
  executionIdentity,
} from '../../../../dist/library/architecture/execution-context.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { ExecutionAssignment } from '../../../../dist/library/coordination-store/execution-types.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { GeneralFixture } from '../../testing/support/general-fixture.js';

/** Supplies controlled prepared contributions while exercising real confined checks and verifier transport. */
export class AssemblyFixture {
  readonly fixture;

  readonly context;

  readonly host;

  readonly run;

  readonly implementation;

  readonly regression;

  /** Captures a verification operation whose regression needs another owner's implementation. */
  constructor(t: TestContext, mode: 'task' | 'workday' = 'workday', hosted = false) {
    this.fixture = new GeneralFixture(t).fixture;
    writeFileSync(
      join(this.fixture.repo, 'verify.cjs'),
      "if(require('fs').existsSync('b/regression.cjs'))require('./b/regression.cjs');",
    );
    this.fixture.commit();
    this.context = new ExecutionContext().resolve(this.fixture.repo);
    this.host = new ProjectHost(this.fixture.state, this.context);
    t.after(() => this.host.close());
    this.run = hosted ? this.host.submit('REASSESS_PREPARED') : this.runContext(mode);
    this.implementation = this.host.store.enqueue(this.run.id, 'a', 'Implement shared behavior', [
      'Source implements behavior',
    ]);
    this.regression = this.host.store.request(this.implementation.id, {
      key: 'regression',
      owner: 'b',
      objective: 'Test shared behavior',
      acceptance: ['Regression passes with implementation'],
    });
  }

  /** Uses an explicit simulated workday identity without inventing any upstream success receipts. */
  private runContext(mode: 'task' | 'workday') {
    const run = this.host.store.createRun(
      mode,
      this.context.owners,
      'Verify the dependent implementation and regression together',
      { id: 'controlled-assembly-environment', mode: 'simulation' },
    );
    this.host.store.updateRun(run.id, 'running', {
      authorityBase: this.context.base,
      candidateRevision: this.context.base,
      packageId: this.context.packageId,
      executionIdentity: executionIdentity(this.context),
    });
    return this.host.store.run(run.id);
  }

  /** Creates an owner workspace and a real durable checkpoint without scripting a successful host check. */
  async prepare(item: ExecutionAssignment, path: string, content: string): Promise<RecordData> {
    const record = this.record(item);
    await prepareWorkspace(this.fixture.state, record, new AbortController().signal);
    mkdirSync(dirname(join(record.workspace, path)), { recursive: true });
    writeFileSync(join(record.workspace, path), content);
    this.checkpoint(record);
    const revision = new CandidateSnapshots(
      this.fixture.repo,
      join(this.fixture.state, 'snapshots'),
    ).capture(record.workspace, record.base);
    this.host.store.updateAssignment(item.id, 'running', { recordId: record.id });
    this.host.store.prepareContribution(item.id, {
      recordId: record.id,
      base: record.base,
      revision,
      checkpoint: (record.checkpoint as { sha256: string }).sha256,
    });
    return record;
  }

  /** Captures one accountable owner and its original acceptance before any candidate edits. */
  private record(item: ExecutionAssignment): RecordData {
    const record = createWorkspace(this.fixture.state, {
      project: this.fixture.repo,
      base: this.context.base,
      packageId: this.context.packageId,
      bindings: this.context.bindings,
    });
    record.executionRunId = this.run.id;
    record.executionEnvironment = this.run.environment;
    record.assignmentId = item.id;
    record.resolvedAssignment = new ExecutionContext().assignment(this.context, item.owner, {
      schemaVersion: 3,
      kind: 'change',
      changeType: 'behavior',
      objective: item.objective,
      expectedOutcome: item.objective,
      acceptanceCriteria: item.acceptance,
      hostChecks: [],
    });
    return record;
  }

  /** Pins actual candidate bytes and captured authority for the production checkpoint validator. */
  private checkpoint(record: RecordData): void {
    const authority = record.resolvedAssignment as { digest: string };
    const path = join(this.fixture.state, 'runs', record.id, 'controlled-checkpoint.json');
    const bytes = JSON.stringify({
      authorityHash: authority.digest,
      candidateDigest: candidateDigest(record),
    });
    writeFileSync(path, bytes);
    record.checkpoint = { path, sha256: digest(bytes) };
    record.continuationAuthority = authority.digest;
    record.safeCheckpoint = true;
    record.status = 'prepared';
    save(this.fixture.state, record);
  }
}
