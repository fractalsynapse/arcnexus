import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';

/** Creates actual durable runs without a checkout or an execution host. */
export class RunQueryFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-run-query-'));

  readonly state = join(this.root, 'state');

  readonly cli = resolve('dist/cli.js');

  readonly env = { ...process.env, ARCNEXUS_STATE_DIR: this.state };

  /** Retains isolated persistence until each scenario and its subprocesses finish. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
  }

  /** Writes through the production store and closes its writer before returning identities. */
  seed(project = 'first') {
    const store = this.store(project);
    try {
      const task = store.createRun('task', ['owner'], 'Document Alpha');
      store.updateRun(task.id, 'running', { packageId: 'package-a' });
      const other = store.createRun('task', ['owner'], 'Review Beta');
      store.updateRun(other.id, 'paused', { packageId: 'package-b' });
      const workday = store.createRun('workday', ['owner'], 'Stewardship');
      store.updateRun(workday.id, 'idle', { packageId: 'package-a' });
      return { task, other, workday };
    } finally {
      store.close();
    }
  }

  /** Opens a writer only when the test explicitly changes retained lifecycle evidence. */
  store(project = 'first') {
    return new ExecutionStore(join(this.state, 'projects', project, 'execution.sqlite'));
  }

  /** Invokes the built CLI from an unrelated directory with isolated state. */
  command(...args: string[]) {
    return spawnSync(process.execPath, [this.cli, ...args, '--json'], {
      cwd: this.root,
      env: this.env,
      encoding: 'utf8',
      timeout: 15000,
    });
  }

  /** Requires success before interpreting public resource output. */
  value(...args: string[]): any {
    const result = this.command(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
}
