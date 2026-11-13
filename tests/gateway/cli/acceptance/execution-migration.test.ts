import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { TaskCommand } from '../../../../dist/gateway/cli/task-command.js';
import { WorkdayCommand } from '../../../../dist/gateway/cli/workday-command.js';
import { ExecutionControls } from '../../../../dist/library/execution-runtime/execution-controls.js';
import { ExecutionCommand } from '../../../../dist/gateway/cli/execution-command.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import {
  GeneralFixture,
  nativeHostTest,
} from '../../../library/testing/support/general-fixture.js';
import { cli } from '../../../library/testing/support/workflow-fixture.js';

/** Verifies retired execution commands cannot dispatch a second engineering engine. */
class ExecutionMigrationScenarios {
  /** Rejects old execution before consulting paths or acquiring project execution. */
  retired(args: string[]): void {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /retired.*task run|retired.*workday start/i);
  }

  /** Normal help exposes both simple modes without old proposal or budget requirements. */
  help(): void {
    const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /workday start \[package\]/);
    assert.match(result.stdout, /workday pause\|resume\|stop\|status \[id\]/);
    assert.match(
      result.stdout,
      /task run \[package\] "<prompt>" \[--plan \| --component <id> \[--activity <a>\]\] \[--async\]/,
    );
    assert.doesNotMatch(
      result.stdout,
      /max-attempts|timeout-seconds|task plan|legacy-run|workday run/,
    );
  }
}

const scenarios = new ExecutionMigrationScenarios();

for (const args of [
  ['run', 'owner', 'objective'],
  ['workday', 'run', 'missing-manifest.yaml'],
  ['task', 'plan'],
  ['task', 'legacy-run', 'historical-proposal'],
])
  test(`retired ${args.slice(0, 2).join(' ')} returns a migration diagnostic`, () =>
    scenarios.retired(args));

test('normal CLI help presents only the simple execution modes', () => scenarios.help());

/** Checks gateway cancellation forwarding without replacing the runtime lifecycle contract. */
class ControlCancellationScenarios {
  /** Preserves answer slots and propagates cancellation errors without retrying a task control. */
  async task(t: TestContext, action: string): Promise<void> {
    const controller = new AbortController();
    const reason = new Error('Cancelled while acquiring host');
    const control = t.mock.method(ExecutionControls.prototype, 'task', async () => {
      controller.abort(reason);
      throw reason;
    });
    const answer = action === 'answer' ? 'Continue with the accepted plan' : undefined;
    const args = ['task', action, 'task-id', ...(answer ? [answer] : [])];
    await assert.rejects(new TaskCommand(args, {}, controller.signal).run(), (e) => e === reason);
    assert.equal(control.mock.callCount(), 1, 'task cancellation must not replay the control');
    assert.deepEqual(
      control.mock.calls[0]!.arguments,
      [action, 'task-id', answer, undefined, controller.signal],
      'task controls forward caller AbortSignal',
    );
  }

  /** Passes caller cancellation to ordinary host readiness without coupling detached host lifetime. */
  async ordinaryHost(t: TestContext): Promise<void> {
    const controller = new AbortController();
    const calls: unknown[][] = [];
    const command = Object.create(ExecutionCommand.prototype) as ExecutionCommand;
    Object.defineProperty(command, 'client', {
      value: {
        ensure: async (...args: unknown[]) => calls.push(args),
        request: async () => ({ accepted: true }),
      },
    });
    t.mock.method(console, 'log', () => {});
    Object.defineProperty(command, 'signal', { value: controller.signal });
    await command.workday('resume');
    assert.deepEqual(
      calls,
      [['resume', controller.signal]],
      'ordinary host readiness receives caller AbortSignal',
    );
  }

  /** Preserves retained workday identity and surfaces cancellation without repeating a mutation. */
  async workday(t: TestContext, action: string): Promise<void> {
    const controller = new AbortController();
    const reason = new Error('Cancelled while acquiring host');
    const control = t.mock.method(ExecutionControls.prototype, 'workday', async () => {
      controller.abort(reason);
      throw reason;
    });
    const command = new WorkdayCommand(['workday', action, 'workday-id'], {}, controller.signal);
    await assert.rejects(command.run(), (e) => e === reason);
    assert.equal(control.mock.callCount(), 1, 'workday cancellation must not replay the control');
    assert.deepEqual(
      control.mock.calls[0]!.arguments,
      [action, 'workday-id', undefined, controller.signal],
      'workday controls forward caller AbortSignal',
    );
  }
}

const cancellation = new ControlCancellationScenarios();

for (const action of ['pause', 'resume', 'stop', 'answer'])
  test(`task ${action} forwards cancellation without replay`, (t) => cancellation.task(t, action));

for (const action of ['pause', 'resume', 'stop'])
  test(`workday ${action} forwards cancellation without replay`, (t) =>
    cancellation.workday(t, action));

test('ordinary workday host readiness receives caller cancellation', (t) =>
  cancellation.ordinaryHost(t));

/** Exercises caller cancellation across the built CLI and detached host readiness boundary. */
class BuiltCliCancellationScenario {
  /** Delays only the production host listener while retaining real CLI and host processes. */
  delayHost(f: GeneralFixture['fixture']): string {
    const preload = join(f.root, 'delay-host.mjs');
    writeFileSync(
      preload,
      `import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (process.argv[1]?.endsWith('/host-main.js'))
    return setTimeout(() => listen.apply(this, args), 1800);
  return listen.apply(this, args);
};
`,
    );
    return preload;
  }

  /** Cancels submission during readiness and confirms no task dispatch or host termination. */
  async run(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    const preload = this.delayHost(f);
    try {
      const child = spawn(
        process.execPath,
        [cli, 'task', 'run', 'Must not be submitted', '--async'],
        {
          cwd: f.repo,
          env: { ...f.env, NODE_OPTIONS: `--import=${preload}` },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      await this.cancelDuringReadiness(child, f.state, t.signal);
      await this.waitForLifecycle(() => this.hostReady(f.state), t.signal);
      general.captureHost();
      assert.equal(
        this.gone(general.hostPid!),
        false,
        'caller cancellation must leave the host alive',
      );
      this.assertNoTaskWasSubmitted(f);
    } finally {
      await this.captureHostForCleanup(general);
    }
  }

  /** Interrupts the public CLI while its detached production host is not ready. */
  private async cancelDuringReadiness(
    child: ReturnType<typeof spawn>,
    state: string,
    signal: AbortSignal,
  ): Promise<void> {
    const stderrStream = child.stderr;
    const stdoutStream = child.stdout;
    assert.ok(stderrStream && stdoutStream, 'CLI child pipes must be available');
    let stderr = '';
    stderrStream.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    const exit = new Promise<number | null>((resolve) => child.once('exit', resolve));
    const output = this.drain(stdoutStream);
    await this.waitForLifecycle(() => this.hostLogExists(state), signal);
    await delay(100);
    child.kill('SIGINT');
    assert.equal(await exit, 130, stderr);
    assert.match(stderr, /AbortError: The operation was aborted/);
    assert.equal(this.hostReady(state), false, 'CLI must exit before host readiness');
    await output;
  }

  /** Captures a delayed host after assertion failures so fixture cleanup can stop it. */
  private async captureHostForCleanup(general: GeneralFixture): Promise<void> {
    if (general.hostPid) return;
    await this.waitFor(() => this.hostReady(general.fixture.state)).catch(() => {});
    if (this.hostReady(general.fixture.state)) general.captureHost();
  }

  /** Drains standard output until the CLI exits so its pipe cannot block shutdown. */
  private async drain(stdout: NonNullable<ReturnType<typeof spawn>['stdout']>): Promise<void> {
    for await (const _chunk of stdout) {
      // The CLI cancellation result is asserted through its exit status and stderr.
    }
  }

  /** Checks retained task state through the built CLI after readiness completes. */
  private assertNoTaskWasSubmitted(f: GeneralFixture['fixture']): void {
    const result = spawnSync(process.execPath, [cli, 'task', 'list', '--json'], {
      cwd: f.repo,
      env: f.env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).items, []);
  }

  /** Detects detached host launch independently from its later socket readiness. */
  private hostLogExists(state: string): boolean {
    return this.projectDirectories(state).some((path) => existsSync(join(path, 'host.log')));
  }

  /** Detects when the production host publishes its listening socket identity. */
  private hostReady(state: string): boolean {
    return this.projectDirectories(state).some((path) => existsSync(join(path, 'host.json')));
  }

  /** Lists isolated state directories created by the real CLI invocation. */
  private projectDirectories(state: string): string[] {
    try {
      return readdirSync(join(state, 'projects')).map((name) => join(state, 'projects', name));
    } catch {
      return [];
    }
  }

  /** Waits for fixture cleanup without extending a failed test indefinitely. */
  private async waitFor(observed: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (observed()) return;
      await delay(25);
    }
    assert.fail('Expected CLI host lifecycle observation did not occur');
  }

  /** Waits for host lifecycle state until the test runner cancels the scenario. */
  private async waitForLifecycle(observed: () => boolean, signal: AbortSignal): Promise<void> {
    while (!observed()) await delay(25, undefined, { signal });
  }

  /** Treats reaped or zombie host processes as unable to dispatch further work. */
  private gone(pid: number): boolean {
    try {
      return (
        readFileSync(`/proc/${pid}/stat`).toString('utf8').split(') ')[1]!.split(' ')[0] === 'Z'
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
  }
}

const builtCliCancellation = new BuiltCliCancellationScenario();

nativeHostTest(
  'built CLI cancellation leaves the detached host alive and sends no task mutation',
  { timeout: 15000 },
  (t) => builtCliCancellation.run(t),
);

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
