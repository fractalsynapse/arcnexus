import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli, type WorkflowFixture } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Kills the actual background host while its managed harness is active and inspects recovery. */
class HostLossScenario {
  /** Parent loss kills managed execution and a replacement host retains uncertainty without replay. */
  async run(t: TestContext, signal: 'SIGKILL' | 'SIGTERM' | 'SIGINT' = 'SIGKILL'): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-host-loss-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const gate = join(directory, 'release');
    const general = new GeneralFixture(t, gate);
    const client = spawn(process.execPath, [cli, 'task', 'run', 'Research supplier evidence'], {
      cwd: general.fixture.repo,
      env: general.fixture.env,
      stdio: 'ignore',
    });
    const finished = new Promise((resolve) => client.once('exit', resolve));
    try {
      await this.until(() => existsSync(gate + '.entered'), 4800);
      general.captureHost();
      const managed = Number(readFileSync(gate + '.entered', 'utf8'));
      process.kill(general.hostPid!, signal);
      await this.until(() => this.gone(managed));
      await finished;
      this.recovery(general, signal !== 'SIGKILL');
    } finally {
      client.kill('SIGINT');
      await finished;
      try {
        general.captureHost();
        process.kill(general.hostPid!, 'SIGTERM');
      } catch {
        /* Already stopped. */
      }
    }
  }

  /** Reads without recovery, then refuses unsafe explicit resumption without replaying model work. */
  private recovery(general: GeneralFixture, orderly: boolean): void {
    const f = general.fixture;
    const calls = readFileSync(f.calls, 'utf8');
    const listed = spawnSync(process.execPath, [cli, 'task', 'list', '--json'], {
      cwd: f.root,
      env: f.env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(listed.status, 0, listed.stderr);
    const run = JSON.parse(listed.stdout).items[0];
    if (orderly) assert.equal(run.status, 'interrupted');
    const id = run.id;
    const result = spawnSync(process.execPath, [cli, 'task', 'resume', id], {
      cwd: f.root,
      env: f.env,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 1, result.stderr);
    general.captureHost();
    this.retained(f, id, calls);
  }

  /** Confirms recovery retained the blocker and evidence without issuing another model call. */
  private retained(f: WorkflowFixture, id: string, calls: string): void {
    const retained = spawnSync(process.execPath, [cli, 'task', 'get', id, '--json'], {
      cwd: f.root,
      env: f.env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(retained.status, 0, retained.stderr);
    assert.equal(JSON.parse(retained.stdout).run.status, 'needs_attention');
    assert.equal(readFileSync(f.calls, 'utf8'), calls);
    this.evidence(f);
  }

  /** Requires the interrupted activation's actual report and unsafe checkpoint to remain available. */
  private evidence(f: WorkflowFixture): void {
    const records = readdirSync(join(f.state, 'runs')).map((id) =>
      JSON.parse(readFileSync(join(f.state, 'runs', id, 'report.json'), 'utf8')),
    );
    const worker = records.find((record) => record.assignmentId && record.stage === 'planning');
    assert.ok(worker);
    assert.equal(worker.safeCheckpoint, false);
    assert.ok(worker.commands.length > 0);
  }

  /** Observes a known test-owned process without sending it another signal. */
  private gone(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  }

  /** Applies only a test watchdog while waiting for observable lifecycle changes. */
  private async until(observed: () => boolean, observations = 600): Promise<void> {
    for (let observation = 0; observation < observations; observation++) {
      if (observed()) return;
      await delay(25);
    }
    assert.fail('Host-loss observation did not settle');
  }
}

const scenario = new HostLossScenario();

test('host loss stops managed execution and refuses unsafe task resumption without replay', (t) =>
  scenario.run(t));

for (const signal of ['SIGTERM', 'SIGINT'] as const)
  test(
    'host ' + signal + ' drains managed execution and persists interruption before recovery',
    (t) => scenario.run(t, signal),
  );

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
