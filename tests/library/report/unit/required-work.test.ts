import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { ExecutionReports } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Keeps archived dependency work visible without presenting it as runnable or verified. */
class RequiredWorkReportScenario {
  /** Projects the same required-work decision used by scheduling and goal completion. */
  run(t: TestContext): void {
    const { root, store, run, source, supplier, request } = this.fixture(t);
    store.admitDirection(
      run.id,
      [],
      [{ assignmentId: source.id, ownerId: 'a', reason: 'Obsolete' }],
      {},
      {
        id: 'decision',
        retirements: [{ assignmentId: source.id, requestId: request.id, rationale: 'Obsolete' }],
      },
    );
    const view = new ExecutionReports(root, store).view(run.id);
    assert.equal(view.assignments.length, 2);
    assert.equal(view.assignments.find((a) => a.id === supplier.id)?.required, false);
    assert.equal(view.assignments.find((a) => a.id === supplier.id)?.status, 'ready');
    assert.deepEqual(view.counts, { ready: 1, waiting: 0, verified: 0 });
  }

  /** Captures a real persisted request before its explicit direction retirement. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-required-report-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['a', 'b'], 'Original goal');
    const source = store.enqueue(run.id, 'a', 'Original assignment');
    const supplier = store.request(source.id, {
      key: 'obsolete',
      owner: 'b',
      objective: 'Obsolete request',
      acceptance: ['Original evidence'],
    });
    const request = store.inbox(source.id)[0]!;
    return { root, store, run, source, supplier, request };
  }
}

const scenario = new RequiredWorkReportScenario();

test('execution reports retain disconnected work without advertising dispatch or delivery', (t) =>
  scenario.run(t));

const noEscalationReport = `{
  "run": {
    "id": "RUN_ID",
    "mode": "task",
    "objective": "Report escalations",
    "status": "running",
    "createdAt": "CREATED_AT",
    "data": {}
  },
  "assignments": [
    {
      "id": "ASSIGNMENT_ID",
      "required": true,
      "owner": "report",
      "objective": "Report wait",
      "status": "ready",
      "dependencies": [],
      "evidence": [],
      "inbox": 0
    }
  ],
  "counts": {
    "ready": 1,
    "waiting": 0,
    "verified": 0
  },
  "report": "REPORT_PATH"
}`;

/** Exercises escalation reporting against the real public store and report APIs. */
class EscalationReportScenario {
  /** Makes a waiting assignment's cause and remaining recorded steps inspectable. */
  outstanding(t: TestContext): void {
    const f = this.fixture(t);
    const escalation = this.open(f, 'Waiting for coordination-store answer');
    const foreign = f.store.createRun('task', ['report'], 'Another run');
    const assignment = f.store.enqueue(foreign.id, 'report', 'Unrelated work');
    this.open({ ...f, run: foreign, assignment }, 'Unrelated wait');
    const report = JSON.parse(JSON.stringify(f.reports.view(f.run.id)));
    assert.deepEqual(
      report.assignments[0].escalations,
      [
        {
          id: escalation.id,
          assignmentId: f.assignment.id,
          owner: 'report',
          status: 'outstanding',
          reason: 'Waiting for coordination-store answer',
          openStepCount: 2,
        },
      ],
      'outstanding escalation includes assignment, owner, reason and open step count',
    );
  }

  /** Retains a completed wait's resolution without advertising outstanding work. */
  resolved(t: TestContext): void {
    const f = this.fixture(t, 'workday');
    const escalation = this.open(f, 'Waiting for an answer');
    f.store.escalations.close(escalation.id, 'Public API answer supplied');
    const report = JSON.parse(JSON.stringify(f.reports.view(f.run.id)));
    assert.deepEqual(
      report.assignments[0].escalations,
      [
        {
          id: escalation.id,
          assignmentId: f.assignment.id,
          owner: 'report',
          status: 'resolved',
          reason: 'Waiting for an answer',
          openStepCount: 2,
          resolution: 'Public API answer supplied',
        },
      ],
      'resolved escalation is labeled resolved and retains its resolution',
    );
  }

  /** Keeps resolved history and a later wait distinct for the same assignment. */
  mixed(t: TestContext): void {
    const f = this.fixture(t);
    const history = this.open(f, 'Earlier wait');
    f.store.escalations.close(history.id, 'Earlier answer');
    const current = this.open(f, 'Later wait');
    const report = JSON.parse(JSON.stringify(f.reports.view(f.run.id)));
    const escalations: any[] = report.assignments[0].escalations ?? [];
    assert.equal(escalations.length, 2, 'mixed report retains both escalations');
    assert.deepEqual(
      escalations.filter((item) => item.status === 'outstanding').map((item) => item.id),
      [current.id],
      'resolved history is never presented as outstanding',
    );
    assert.equal(escalations.find((item) => item.id === history.id)?.status, 'resolved');
    assert.equal(escalations.find((item) => item.id === history.id)?.resolution, 'Earlier answer');
  }

  /** Pins the complete pre-change serialized report for runs without escalation entities. */
  absent(t: TestContext): void {
    const f = this.fixture(t);
    const path = join(f.root, 'reports', f.run.id + '.json');
    const expected = noEscalationReport
      .replace('"RUN_ID"', JSON.stringify(f.run.id))
      .replace('"CREATED_AT"', JSON.stringify(f.run.createdAt))
      .replace('"ASSIGNMENT_ID"', JSON.stringify(f.assignment.id))
      .replace('"REPORT_PATH"', JSON.stringify(path));
    assert.equal(JSON.stringify(f.reports.view(f.run.id), null, 2), expected);
    f.reports.save(f.run.id);
    assert.equal(readFileSync(path, 'utf8'), expected);
  }

  /** Creates isolated durable run state and releases the store before removing its files. */
  private fixture(t: TestContext, mode: 'task' | 'workday' = 'task') {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-escalation-report-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun(mode, ['report'], 'Report escalations');
    const assignment = store.enqueue(run.id, 'report', 'Report wait');
    return { root, store, run, assignment, reports: new ExecutionReports(root, store) };
  }

  /** Records a wait through the existing API without changing assignment authority. */
  private open(f: ReturnType<EscalationReportScenario['fixture']>, reason: string) {
    return f.store.escalations.open({
      runId: f.run.id,
      assignmentId: f.assignment.id,
      owner: f.assignment.owner,
      goal: { objective: f.assignment.objective, acceptance: f.assignment.acceptance },
      planRevision: 1,
      openSteps: [
        { id: 'implement', activity: 'implementation', status: 'blocked' },
        { id: 'review', activity: 'review', status: 'pending' },
      ],
      evidence: [],
      reason,
    });
  }
}

const escalationScenario = new EscalationReportScenario();

test('run report exposes an outstanding escalation through the public store', (t) =>
  escalationScenario.outstanding(t));

test('run report labels a resolved escalation with its resolution', (t) =>
  escalationScenario.resolved(t));

test('run report distinguishes outstanding waits from resolved history', (t) =>
  escalationScenario.mixed(t));

test('run report without escalations preserves exact serialized output', (t) =>
  escalationScenario.absent(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'recovery'] });
