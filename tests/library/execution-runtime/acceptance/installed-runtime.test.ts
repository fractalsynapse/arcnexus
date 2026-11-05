import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
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

  /** Installs the real built launcher with a minimal declared dependency manifest. */
  private install(root: string): string {
    const module = 'dist/library/execution-runtime/host-runtime.js';
    mkdirSync(join(root, 'dist/library/execution-runtime'), { recursive: true });
    cpSync(resolve(module), join(root, module));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(join(root, 'package-lock.json'), '{}');
    return join(root, module);
  }
}

const scenario = new InstalledRuntimeScenario();

test('installed runtime records upgrades once without copying executables', (t) => scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'host-lifecycle'],
});
