import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises asynchronous submission and identity controls through the actual detached supervisor. */
class TaskControlCliScenario {
  /** Pauses an active turn, recovers its original supervisor, and cancels from outside a checkout. */
  async run(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const command = this.command(general);
    const run = command(f.repo, 'task', 'run', 'Research supplier evidence', '--async');
    general.captureHost();
    const paused = command(f.root, 'task', 'pause', run.id);
    assert.ok(['paused', 'pausing'].includes(paused.run.status));
    await this.until(() => command(f.root, 'task', 'get', run.id).run.status === 'paused');
    const retained = command(f.root, 'task', 'get', run.id);
    const metadata = this.metadata(general);
    process.kill(general.hostPid!, 'SIGKILL');
    await this.until(() => this.gone(general.hostPid!));
    const resumed = command(f.root, 'task', 'resume', run.id);
    general.captureHost();
    assert.equal(resumed.run.status, 'running');
    assert.deepEqual(this.metadata(general).runner, metadata.runner);
    assert.equal(resumed.run.data.executionIdentity, retained.run.data.executionIdentity);
    assert.equal(command(f.root, 'task', 'stop', run.id).run.status, 'cancelled');
    assert.equal(command(f.root, 'task', 'stop', run.id).run.status, 'cancelled');
  }

  /** Resolves a registered package and submits work from a directory outside every checkout. */
  async registered(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const command = this.command(general);
    command(f.root, 'platform', 'create', 'platform', f.repo);
    command(f.root, 'package', 'create', 'platform/package', f.repo);
    const run = command(
      f.root,
      'task',
      'run',
      'platform/package',
      'Research supplier evidence',
      '--async',
    );
    general.captureHost();
    assert.equal(run.data.packageId, 'package');
    assert.equal(command(f.root, 'task', 'stop', run.id).run.status, 'cancelled');
  }

  /** Rejects a modified supervisor before recovery starts a process or changes retained run status. */
  async tampered(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const command = this.command(general);
    const run = command(f.repo, 'task', 'run', 'Research supplier evidence', '--async');
    general.captureHost();
    command(f.root, 'task', 'pause', run.id);
    await this.until(() => command(f.root, 'task', 'get', run.id).run.status === 'paused');
    const metadata = this.metadata(general);
    process.kill(general.hostPid!, 'SIGKILL');
    await this.until(() => this.gone(general.hostPid!));
    writeFileSync(join(metadata.runner.directory, 'dist/cli.js'), '// unauthorized alteration');
    const result = spawnSync(process.execPath, [cli, 'task', 'resume', run.id], {
      cwd: f.root,
      env: f.env,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /supervising runtime changed/);
    assert.equal(command(f.root, 'task', 'get', run.id).run.status, 'paused');
    assert.ok(this.gone(general.hostPid!));
  }

  /** Reads host evidence after each startup to verify stable runtime identity. */
  private metadata(general: GeneralFixture) {
    const projects = join(general.fixture.state, 'projects');
    return JSON.parse(readFileSync(join(projects, readdirSync(projects)[0]!, 'host.json'), 'utf8'));
  }

  /** Executes public commands with a finite test watchdog, preserving diagnostics on failure. */
  private command(general: GeneralFixture) {
    return (cwd: string, ...args: string[]) => {
      const result = spawnSync(process.execPath, [cli, ...args, '--json'], {
        cwd,
        env: { ...general.fixture.env, ARCNEXUS_VOLUME: join(general.fixture.root, 'volume') },
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      return JSON.parse(result.stdout);
    };
  }

  /** Treats reaped or zombie Linux processes as unable to dispatch further work. */
  private gone(pid: number): boolean {
    const path = `/proc/${pid}/stat`;
    return !existsSync(path) || readFileSync(path, 'utf8').split(' ')[2] === 'Z';
  }

  /** Bounds fixture observation only; product work has no execution deadline. */
  private async until(observed: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (observed()) return;
      await delay(50);
    }
    assert.fail('Task control observation did not settle');
  }
}

const scenario = new TaskControlCliScenario();

test('task controls work outside a checkout and recover the retained supervisor', (t) =>
  scenario.run(t));

test('task recovery refuses changed supervising code before dispatch', (t) => scenario.tampered(t));

test('registered package task submission works outside a checkout', (t) => scenario.registered(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
