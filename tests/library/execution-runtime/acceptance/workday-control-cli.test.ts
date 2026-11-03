import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises registered workday targeting and retained identity controls through the production CLI. */
class WorkdayControlCliScenario {
  /** Runs from outside the repository and retains each workday's identity through recovery and replacement. */
  async run(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const command = this.command(general);
    try {
      command('platform', 'create', 'platform', general.fixture.repo);
      command('package', 'create', 'platform/package', general.fixture.repo);
      const started = command('workday', 'start', 'platform/package');
      general.captureHost();
      const id = started.workday.id;
      assert.equal(command('workday', 'status').workday.id, id);
      command('workday', 'pause', id);
      await this.until(() => command('workday', 'status', id).workday.status === 'paused');
      await this.recover(general, command, id);
      await this.history(command, id);
    } finally {
      if (general.hostPid && !this.gone(general.hostPid)) {
        process.kill(general.hostPid, 'SIGTERM');
        await this.until(() => this.gone(general.hostPid!));
      }
    }
  }

  /** Status after host death remains read-only; explicit resume restarts the retained supervisor. */
  private async recover(
    general: GeneralFixture,
    command: (...args: string[]) => any,
    id: string,
  ): Promise<void> {
    const paused = command('workday', 'status', id);
    process.kill(general.hostPid!, 'SIGKILL');
    await this.until(() => this.gone(general.hostPid!));
    assert.equal(command('workday', 'status', id).revision, paused.revision);
    assert.ok(this.gone(general.hostPid!));
    const resumed = command('workday', 'resume', id);
    general.captureHost();
    assert.equal(resumed.workday.status, 'running');
    assert.equal(resumed.workday.data.executionIdentity, paused.workday.data.executionIdentity);
  }

  /** Controls on a stopped historical identity cannot stop the next active workday. */
  private async history(command: (...args: string[]) => any, id: string): Promise<void> {
    command('workday', 'stop', id);
    await this.until(() => command('workday', 'status', id).workday.status === 'stopped');
    const started = command('workday', 'start', 'platform/package');
    assert.notEqual(started.workday.id, id);
    assert.equal(command('workday', 'stop', id).workday.id, id);
    assert.ok(
      ['running', 'idle'].includes(command('workday', 'status', started.workday.id).workday.status),
    );
    command('workday', 'stop', started.workday.id);
  }

  /** Runs all public commands outside Git with one private managed volume and evidence root. */
  private command(general: GeneralFixture) {
    const f = general.fixture;
    return (...args: string[]) => {
      const result = spawnSync(process.execPath, [cli, ...args, '--json'], {
        cwd: f.root,
        env: { ...f.env, ARCNEXUS_VOLUME: join(f.root, 'volume') },
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      return JSON.parse(result.stdout);
    };
  }

  /** Observes known test-owned processes without retaining a zombie as an active supervisor. */
  private gone(pid: number): boolean {
    const path = `/proc/${pid}/stat`;
    return !existsSync(path) || readFileSync(path, 'utf8').split(' ')[2] === 'Z';
  }

  /** Bounds only test observation, never the lifetime of application work. */
  private async until(observed: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (observed()) return;
      await delay(50);
    }
    assert.fail('Workday control observation did not settle');
  }
}

const scenario = new WorkdayControlCliScenario();

test('workday identity controls recover captured execution outside a checkout', (t) =>
  scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
