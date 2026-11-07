import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { HostConnection } from '../../../../dist/library/execution-runtime/host-connection.js';
import { HostReadiness } from '../../../../dist/library/execution-runtime/host-readiness.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks one installed runtime and one transition ledger without per-run executable copies. */
class InstalledRuntimeScenario {
  /** Repeated starts reuse identity; changed code records a transition while old events remain intact. */
  async run(t: TestContext): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-installed-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const entry = this.install(root);
    const { HostRuntime } = await import(pathToFileURL(entry).href);
    const runtime = new HostRuntime();
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => store.close());
    const first = runtime.record(store, root);
    assert.equal(resolve(first.directory), root);
    runtime.record(store, root);
    assert.equal(store.events().length, 1);
    const original = JSON.stringify(store.events()[0]);
    writeFileSync(join(root, 'dist/upgrade.js'), '// installed upgrade\n');
    const second = runtime.record(store, root);
    assert.notEqual(second.hash, first.hash);
    assert.equal(store.events().length, 2);
    assert.equal(JSON.stringify(store.events()[0]), original);
    assert.deepEqual(store.events()[1]!.data.previous, { id: 'host', ...first });
    assert.deepEqual(store.events()[1]!.data.current, { id: 'host', ...second });
    assert.equal(existsSync(join(root, 'supervisors')), false);
  }

  /** Caller cancellation interrupts an in-flight identity probe without depending on socket permissions. */
  async cancelled(): Promise<void> {
    const connection = {
      request: () => new Promise(() => {}),
    } as unknown as HostConnection;
    const controller = new AbortController();
    const waiting = new HostReadiness().wait(
      connection,
      'repository-key',
      undefined,
      join(tmpdir(), 'unused-host.log'),
      undefined,
      controller.signal,
    );
    setTimeout(() => controller.abort(new Error('caller cancelled')), 50);
    await assert.rejects(waiting, /caller cancelled/);
  }

  /** Startup diagnostics retain an observed process failure and its log without replaying control. */
  async failedStartup(t: TestContext): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-startup-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const log = join(root, 'host.log');
    writeFileSync(log, 'Error [ERR_MODULE_NOT_FOUND]: missing host startup module');
    const child = new EventEmitter() as unknown as ChildProcess;
    const connection = {
      request: async () => {
        const error = new Error('connection refused') as NodeJS.ErrnoException;
        error.code = 'ECONNREFUSED';
        throw error;
      },
    } as unknown as HostConnection;
    const waiting = new HostReadiness().wait(connection, 'repository-key', child, log);
    setTimeout(() => child.emit('close', 1, null), 50);
    await assert.rejects(waiting, (error: unknown) => {
      assert.match(String(error), /process exited with code 1/);
      assert.match(String(error), /host\.log/);
      assert.match(String(error), /ERR_MODULE_NOT_FOUND/);
      return true;
    });
  }

  /** Installs the real built launcher with a minimal declared dependency manifest. */
  private install(root: string): string {
    const module = 'dist/library/execution-runtime/host-runtime.js';
    for (const path of [module, 'dist/library/operations/installed-runtime.js']) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      cpSync(resolve(path), join(root, path));
    }
    writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(join(root, 'package-lock.json'), '{}');
    return join(root, module);
  }
}

const scenario = new InstalledRuntimeScenario();

test('installed runtime records upgrades once without copying executables', (t) => scenario.run(t));

test('readiness waiting stops promptly on caller cancellation', { timeout: 5000 }, () =>
  scenario.cancelled(),
);

test(
  'readiness diagnostics retain an observed production startup failure',
  { timeout: 5000 },
  (t) => scenario.failedStartup(t),
);

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'host-lifecycle'],
});
