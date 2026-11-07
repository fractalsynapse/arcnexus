import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises asynchronous submission and identity controls through the actual detached supervisor. */
class TaskControlCliScenario {
  /** A live process remains observable, while a reaped process is accepted without a racy existence probe. */
  processObservation(): void {
    assert.equal(this.gone(process.pid), false);
    const child = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(this.gone(child.pid), true);
  }

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
    this.feedback(command, f.root, run.id);
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

  /** Routes caller review through the real CLI while retaining pause for ordinary recovery. */
  private feedback(
    command: ReturnType<TaskControlCliScenario['command']>,
    root: string,
    id: string,
  ): void {
    const answered = command(root, 'task', 'answer', id, 'Preserve the original acceptance');
    assert.equal(answered.run.status, 'paused');
    assert.match(answered.run.data.prompt, /Architect response: Preserve the original acceptance/);
    assert.equal(command(root, 'task', 'get', id).run.status, 'paused');
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

  /** Two real clients converge on the host despite its loser's diagnostic leaving the log tail. */
  async competingAcquisition(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const id = await this.pauseForRecovery(general);
    const entry = this.installDelayedHost(f.root);
    const hostClientModule = await import(
      resolve(dirname(entry), 'library/execution-runtime/host-client.js')
    );
    try {
      const clients = [
        new hostClientModule.HostClient(f.repo, f.state),
        new hostClientModule.HostClient(f.repo, f.state),
      ];
      await Promise.all(clients.map((client: HostClient) => client.ensure('status')));
      general.captureHost();
      const metadata = this.metadata(general);
      assert.equal(metadata.pid, general.hostPid);
      assert.equal(this.gone(metadata.pid), false, 'the canonical lease owner remains live');
      assert.equal(clients[0]!.socket, clients[1]!.socket);
      assert.equal(this.command(general)(f.root, 'task', 'get', id).run.status, 'paused');
      this.assertLosingLauncherLog(f.state);
    } finally {
      await delay(7000);
      general.captureHost();
      await this.stop(general);
    }
  }

  /** Proves losing production startup output exceeds the retained diagnostic tail. */
  private assertLosingLauncherLog(state: string): void {
    const projects = join(state, 'projects');
    const log = readFileSync(join(projects, readdirSync(projects)[0]!, 'host.log'), 'utf8');
    assert.match(log, /losing launcher failure diagnostic/);
    assert.ok(log.length > 4000, 'losing launcher diagnostics exceed the retained log tail');
    assert.equal(
      log.slice(-4000).includes('A host already owns project execution'),
      false,
      'the ownership failure precedes trailing loser diagnostics',
    );
  }

  /** Exercises ordinary answer and resume against the real host after slow initialization. */
  async delayedStartup(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const id = await this.pauseForRecovery(general);
    const entry = this.installDelayedHost(f.root);
    const recovered = this.command(general, entry);
    try {
      assert.doesNotThrow(
        () => this.feedback(recovered, f.root, id),
        'ordinary answer waits for delayed production host readiness',
      );
      general.captureHost();
      await this.stop(general);
      const resumed = recovered(f.root, 'task', 'resume', id);
      assert.equal(resumed.run.status, 'running');
    } finally {
      await delay(7000);
      general.captureHost();
      await this.stop(general);
    }
  }

  /** A broken installed dependency produces an actual loader failure and retained diagnostics. */
  async failedStartup(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const id = await this.pauseForRecovery(general);
    const entry = this.installUpgrade(f.root);
    rmSync(join(dirname(entry), 'library/execution-runtime/host-main.js'));
    const hostClientModule = await import(
      resolve(dirname(entry), 'library/execution-runtime/host-client.js')
    );
    const client = new hostClientModule.HostClient(f.repo, f.state);
    await assert.rejects(client.ensure('task-resume'), (error: Error) => {
      assert.match(error.message, /process exited with code/);
      assert.match(error.message, /host[.]log/);
      return true;
    });
    const projects = join(f.state, 'projects');
    const log = readFileSync(join(projects, readdirSync(projects)[0]!, 'host.log'), 'utf8');
    assert.match(log, /MODULE_NOT_FOUND/);
    assert.equal(this.command(general)(f.root, 'task', 'get', id).run.status, 'paused');
    general.captureHost();
    await this.stop(general);
  }

  /** A retained CLI resume reports a broken installed host and preserves the paused checkpoint. */
  async retainedFailedStartup(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const id = await this.pauseForRecovery(general);
    const entry = this.installUpgrade(f.root);
    rmSync(join(dirname(entry), 'library/execution-runtime/host-main.js'));
    try {
      const result = spawnSync(process.execPath, [entry, 'task', 'resume', id, '--json'], {
        cwd: f.root,
        env: { ...f.env, ARCNEXUS_VOLUME: join(f.root, 'volume') },
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(result.status, 1, result.stderr + result.stdout);
      assert.match(result.stderr + result.stdout, /host[.]log/);
      const projects = join(f.state, 'projects');
      const log = readFileSync(join(projects, readdirSync(projects)[0]!, 'host.log'), 'utf8');
      assert.match(log, /MODULE_NOT_FOUND/);
      assert.equal(this.command(general)(f.root, 'task', 'get', id).run.status, 'paused');
    } finally {
      general.captureHost();
      await this.stop(general);
    }
  }

  /** Retains a paused task and stops its host so the next control must recover production state. */
  private async pauseForRecovery(general: GeneralFixture): Promise<string> {
    const f = general.fixture;
    const command = this.command(general);
    const run = command(f.repo, 'task', 'run', 'Research supplier evidence', '--async');
    general.captureHost();
    command(f.root, 'task', 'pause', run.id);
    await this.until(() => command(f.root, 'task', 'get', run.id).run.status === 'paused');
    await this.stop(general);
    return run.id;
  }

  /** Delays after lease acquisition and floods the shared log before endpoint readiness. */
  private installDelayedHost(root: string): string {
    const entry = this.installUpgrade(root);
    const host = join(dirname(entry), 'library/execution-runtime/host-main.js');
    const source = readFileSync(host, 'utf8');
    const startup =
      "new HostServer(root, JSON.parse(readFileSync(context, 'utf8')), socket, context).start();";
    const delayed = [
      'try {',
      "  const server = new HostServer(root, JSON.parse(readFileSync(context, 'utf8')), socket, context);",
      '  await new Promise(resolve => setTimeout(resolve, 6500));',
      "  console.error('retained startup diagnostic '.repeat(500));",
      '  server.start();',
      '} catch (error) {',
      '  console.error(error);',
      "  console.error('losing launcher failure diagnostic '.repeat(500));",
      '  process.exitCode = 1;',
      '}',
    ].join('\n');
    assert.ok(source.includes(startup), 'installed production host startup remains present');
    writeFileSync(host, source.replace(startup, delayed));
    return entry;
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
    try {
      process.kill(general.hostPid!, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
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
    try {
      return (
        readFileSync('/proc/' + pid + '/stat', 'utf8')
          .split(') ')[1]!
          .split(' ')[0] === 'Z'
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
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

test('host cleanup distinguishes live and reaped processes without an existence race', () =>
  scenario.processObservation());

test('task controls recover the installed runtime outside a checkout', (t) => scenario.run(t));

test('task recovery refuses changed authority before dispatch', (t) => scenario.tampered(t));

test('registered package task submission works outside a checkout', (t) => scenario.registered(t));

test('task recovery uses upgraded installed runtime without cloning or replacing the task', (t) =>
  scenario.upgraded(t));

test('concurrent real host acquisition waits for the canonical lease owner despite noisy logs', (t) =>
  scenario.competingAcquisition(t));

test('ordinary answer and resume wait for delayed production host initialization', (t) =>
  scenario.delayedStartup(t));

test('ordinary host acquisition reports an actual production module loading failure', (t) =>
  scenario.failedStartup(t));

test('retained CLI resume reports startup failure and preserves the paused checkpoint', (t) =>
  scenario.retainedFailedStartup(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
