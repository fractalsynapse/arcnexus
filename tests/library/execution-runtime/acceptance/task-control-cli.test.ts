import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises asynchronous submission and identity controls through the actual detached supervisor. */
class TaskControlCliScenario {
  /** Pauses an active turn, recovers through the installed runtime, and cancels from outside a checkout. */
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
    await this.stop(general);
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
    await this.stop(general);
  }

  /** Rejects changed captured authority before recovery starts a process or alters retained work. */
  async tampered(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const command = this.command(general);
    const run = command(f.repo, 'task', 'run', 'Research supplier evidence', '--async');
    general.captureHost();
    command(f.root, 'task', 'pause', run.id);
    await this.until(() => command(f.root, 'task', 'get', run.id).run.status === 'paused');
    process.kill(general.hostPid!, 'SIGKILL');
    await this.until(() => this.gone(general.hostPid!));
    this.changeAuthority(general);
    const result = spawnSync(process.execPath, [cli, 'task', 'resume', run.id], {
      cwd: f.root,
      env: f.env,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /authority does not match/);
    assert.equal(command(f.root, 'task', 'get', run.id).run.status, 'paused');
    assert.ok(this.gone(general.hostPid!));
  }

  /** Resumes the same paused task with upgraded installed code and unchanged task authority. */
  async upgraded(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const command = this.command(general);
    const run = command(f.repo, 'task', 'run', 'Research supplier evidence', '--async');
    general.captureHost();
    command(f.root, 'task', 'pause', run.id);
    await this.until(() => command(f.root, 'task', 'get', run.id).run.status === 'paused');
    const before = this.metadata(general);
    await this.stop(general);
    const entry = this.installUpgrade(f.root);
    const upgraded = this.command(general, entry);
    const resumed = upgraded(f.root, 'task', 'resume', run.id);
    general.captureHost();
    const after = this.metadata(general);
    assert.equal(resumed.run.id, run.id);
    assert.equal(resumed.run.data.executionIdentity, run.data.executionIdentity);
    assert.equal(resolve(after.runner.directory), resolve(dirname(entry), '..'));
    assert.notEqual(after.runner.hash, before.runner.hash);
    assert.equal(existsSync(join(f.state, 'supervisors')), false);
    assert.equal(upgraded(f.root, 'task', 'stop', run.id).run.status, 'cancelled');
    await this.stop(general);
  }

  /** Installs a changed executable version only after the old host has stopped. */
  private installUpgrade(root: string): string {
    const source = resolve(dirname(cli), '..');
    const target = join(root, 'installed-upgrade');
    mkdirSync(target);
    for (const name of ['dist', 'package.json', 'package-lock.json'])
      cpSync(join(source, name), join(target, name), { recursive: true });
    symlinkSync(join(source, 'node_modules'), join(target, 'node_modules'), 'dir');
    writeFileSync(join(target, 'dist/upgrade-marker.js'), '// installed runtime upgrade\n');
    return join(target, 'dist/cli.js');
  }

  /** Corrupts captured authority to prove executable upgrades cannot silently replace permissions. */
  private changeAuthority(general: GeneralFixture): void {
    const projects = join(general.fixture.state, 'projects');
    const path = join(projects, readdirSync(projects)[0]!, this.metadata(general).contextFile);
    const context = JSON.parse(readFileSync(path, 'utf8'));
    context.base = '0'.repeat(40);
    writeFileSync(path, JSON.stringify(context));
  }

  /** Stops the test-owned supervisor before fixture removal can race with cancelled-operation cleanup. */
  private async stop(general: GeneralFixture): Promise<void> {
    process.kill(general.hostPid!, 'SIGTERM');
    await this.until(() => this.gone(general.hostPid!));
  }

  /** Reads host evidence after each startup to verify stable runtime identity. */
  private metadata(general: GeneralFixture) {
    const projects = join(general.fixture.state, 'projects');
    return JSON.parse(readFileSync(join(projects, readdirSync(projects)[0]!, 'host.json'), 'utf8'));
  }

  /** Executes public commands with a finite test watchdog, preserving diagnostics on failure. */
  private command(general: GeneralFixture, entry = cli) {
    return (cwd: string, ...args: string[]) => {
      const result = spawnSync(process.execPath, [entry, ...args, '--json'], {
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

test('task controls recover the installed runtime outside a checkout', (t) => scenario.run(t));

test('task recovery refuses changed authority before dispatch', (t) => scenario.tampered(t));

test('registered package task submission works outside a checkout', (t) => scenario.registered(t));

test('task recovery uses upgraded installed runtime without cloning or replacing the task', (t) =>
  scenario.upgraded(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
