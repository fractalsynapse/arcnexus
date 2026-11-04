import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { cli, type WorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises headless deployment shutdown through the built lifetime service and an actual managed host. */
class ContainerLifetimeScenario {
  /** Drains active work, rejects admission during shutdown and preserves interruption across replacement. */
  async run(t: TestContext): Promise<void> {
    const { gate, general } = this.fixture(t);
    const f = general.fixture;
    const runtime = await this.start(t, f);
    const submitted = this.command(f, 'task', 'run', 'Research supplier evidence', '--async');
    assert.equal(submitted.status, 0, submitted.stderr);
    const id = JSON.parse(submitted.stdout).id;
    general.captureHost();
    await this.until(() => existsSync(gate + '.entered'));
    const managed = Number(readFileSync(gate + '.entered', 'utf8'));
    const exited = new Promise((resolve) => runtime.once('exit', resolve));
    runtime.kill('SIGTERM');
    assert.equal(await exited, 0);
    assert.throws(() => process.kill(managed, 0), { code: 'ESRCH' });
    assert.equal(this.view(f, id).run.status, 'interrupted');
    const blocked = this.command(f, 'task', 'run', 'Must not dispatch', '--async');
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /Container is shutting down/);
    const calls = readFileSync(f.calls, 'utf8');
    const replacement = await this.start(t, f);
    assert.equal(this.view(f, id).run.status, 'interrupted');
    assert.equal(readFileSync(f.calls, 'utf8'), calls);
    const replaced = new Promise((resolve) => replacement.once('exit', resolve));
    replacement.kill('SIGTERM');
    assert.equal(await replaced, 0);
  }

  /** Retains test gate evidence only until teardown and scopes host cleanup to the fixture. */
  private fixture(t: TestContext) {
    const gate = join('/tmp', 'arcnexus-container-gate-' + crypto.randomUUID());
    t.after(() => rmSync(gate + '.entered', { force: true }));
    return { gate, general: new GeneralFixture(t, gate) };
  }

  /** Starts the packaged lifetime entry point and registers cleanup before waiting for its readiness event. */
  private async start(t: TestContext, f: WorkflowFixture): Promise<ChildProcess> {
    const child = spawn(
      process.execPath,
      [resolve('dist/library/execution-runtime/container-main.js')],
      {
        cwd: f.root,
        env: f.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill('SIGTERM');
    });
    let output = '',
      error = '';
    child.stdout!.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr!.on('data', (chunk) => {
      error += String(chunk);
    });
    await this.until(() => {
      if (child.exitCode !== null) throw new Error('Lifetime startup failed: ' + error);
      return output.includes('"status":"ready"');
    });
    return child;
  }

  /** Uses public resource reads without creating or recovering a project host. */
  private view(f: WorkflowFixture, id: string): any {
    const result = this.command(f, 'task', 'get', id);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }

  /** Runs the assembled CLI against the fixture's retained application storage. */
  private command(f: WorkflowFixture, ...args: string[]) {
    return spawnSync(process.execPath, [cli, ...args, '--json'], {
      cwd: f.repo,
      env: f.env,
      encoding: 'utf8',
      timeout: 60_000,
    });
  }

  /** Applies a test watchdog to observable startup and managed-entry conditions, never to application work. */
  private async until(observed: () => boolean): Promise<void> {
    for (let observation = 0; observation < 4800; observation++) {
      if (observed()) return;
      await delay(25);
    }
    assert.fail('Container lifecycle observation did not settle');
  }
}

const scenario = new ContainerLifetimeScenario();

test('container lifetime drains hosts and replacement never replays interrupted work', (t) =>
  scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'host-lifecycle'],
});
