import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import type { StewardCheckFailure } from '../../../direction/src/index.js';
import { HostTask } from '../../src/index.js';

const scope = { owner: 'owner', activity: 'implementation' } as const;
type Scope = Parameters<HostTask['pendingCheck']>[0];

/** Journal recovery inputs through HostTask while retaining readable fixture evidence. */
class RecoveryFixture {
  readonly task: HostTask;

  /** Allocate isolated durable storage and close its writer before removing fixture files. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-observation-precedence-'));
    const remote = 'https://example.com/observation-precedence.git';
    const goal = 'Distinguish satisfied observations from absent observations';
    const journal = new Coordination(root).admit(remote, goal);
    assert('close' in journal);
    const capture = { source: { root, remote } } as Capture;
    this.task = new HostTask(
      { capture, common: root, executable: '', base: 'staging', fresh: true, storage: root },
      goal,
      journal,
    );
    t.after(() => {
      this.task.close();
      rmSync(root, { recursive: true, force: true });
    });
  }

  /** Record a failed check A as supplier feedback with its original diagnostic artifact. */
  feedback(): StewardCheckFailure {
    const log = this.task.store('check-a.log', 'check A diagnostic: exit 37\n');
    const failedCheck: StewardCheckFailure = {
      activity: scope.activity,
      id: 'check-a',
      expected: 'pass',
      status: 37,
      log,
    };
    this.task.note({
      feedback: {
        kind: 'supplier',
        milestone: 'correction',
        requester: scope.owner,
        owner: scope.owner,
        reason: 'Check A failed',
        evidence: [log],
        failedCheck,
      },
    });
    return failedCheck;
  }

  /** Record a numeric check observation and retain its distinct status in readable evidence. */
  observe(id: string, status: number, observed: Scope) {
    const log = this.task.store(`${id}.log`, `${id} diagnostic: exit ${status}\n`);
    this.task.note({
      check: {
        id,
        status,
        log,
        command: 'fixture-check',
        args: [],
        cwd: this.task.capture.source.root,
        durationMs: 1,
      },
      scope: observed,
    });
    return log;
  }
}

for (const expected of ['pass', 'fail'] as const) {
  test(`satisfied ${expected} observation B does not erase failed supplier check A`, (t) => {
    const fixture = new RecoveryFixture(t);
    const failed = fixture.feedback();
    const status = expected === 'pass' ? 0 : 43;
    const log = fixture.observe('check-b', status, { ...scope, expected });
    assert.equal(readFileSync(failed.log, 'utf8'), 'check A diagnostic: exit 37\n');
    assert.equal(readFileSync(log, 'utf8'), `check-b diagnostic: exit ${status}\n`);
    assert.equal(fixture.task.pendingCheck(scope), undefined);
  });

  test(`unresolved ${expected} observation B retains its expectation, exact status and evidence`, (t) => {
    const fixture = new RecoveryFixture(t);
    fixture.feedback();
    const status = expected === 'pass' ? 43 : 0;
    const log = fixture.observe('check-b', status, { ...scope, expected });
    assert.deepEqual(fixture.task.pendingCheck(scope), {
      activity: scope.activity,
      id: 'check-b',
      expected,
      status,
      log,
    });
    assert.equal(readFileSync(log, 'utf8'), `check-b diagnostic: exit ${status}\n`);
  });
}

test('absent qualifying observations preserve supplier feedback recovery', (t) => {
  const fixture = new RecoveryFixture(t);
  const failed = fixture.feedback();
  assert.deepEqual(fixture.task.pendingCheck(scope), failed);
  fixture.observe('check-b', 0, scope);
  fixture.observe('check-c', 0, { ...scope, owner: 'other', expected: 'pass' });
  fixture.observe('check-d', 0, { ...scope, activity: 'testing', expected: 'pass' });
  assert.deepEqual(fixture.task.pendingCheck(scope), failed);
  assert.equal(readFileSync(failed.log, 'utf8'), 'check A diagnostic: exit 37\n');
});

test('feedback fallback is discharged by its later matching result without an expectation', (t) => {
  const fixture = new RecoveryFixture(t);
  fixture.feedback();
  const log = fixture.observe('check-a', 0, scope);
  assert.equal(fixture.task.pendingCheck(scope), undefined);
  assert.equal(readFileSync(log, 'utf8'), 'check-a diagnostic: exit 0\n');
});
