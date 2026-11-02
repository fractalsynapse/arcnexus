import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { cli } from '../../testing/support/workflow-fixture.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Prevents a second scheduler even when it is launched with a different IPC endpoint. */
class CanonicalHostScenario {
  /** The built host must acquire canonical ownership before opening state or recovering work. */
  run(t: TestContext): void {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    const lease = new ExecutionLease(join(context.commonDir, 'arcnexus', 'host.lease.sqlite'));
    t.after(() => lease.close());
    const path = join(f.repo, '.git/arcnexus/second-context.json');
    writeFileSync(path, JSON.stringify(context));
    const result = spawnSync(
      process.execPath,
      [
        cli.replace(/cli\.js$/, 'library/execution-runtime/host-main.js'),
        f.state,
        path,
        join(f.repo, '.git/arcnexus/alternate.sock'),
      ],
      { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 10_000 },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /A host already owns project execution/);
  }
}

const scenario = new CanonicalHostScenario();

test('alternate IPC endpoints cannot acquire another canonical project lease', (t) =>
  scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'canonical-host'],
});
