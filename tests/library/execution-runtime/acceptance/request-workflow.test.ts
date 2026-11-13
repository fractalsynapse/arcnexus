import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises the same inherited workflow at request admission and durable recipient creation. */
class RequestWorkflowScenario {
  /** A recipient without writable regression scope can still receive inherited research or documentation. */
  async run(t: TestContext, documentation: boolean): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    this.profile(f);
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit(
      documentation ? 'INHERIT_DOCUMENTATION: request a supplier' : 'Request supplier research',
    );
    await host.tick();
    await host.tick();
    const assignments = host.store.assignments(run.id);
    assert.equal(assignments.length, 2, 'Valid inherited workflow must not enter correction');
    const sender = assignments.find((item) => item.owner === 'a')!;
    const recipient = assignments.find((item) => item.owner === 'b')!;
    const proposal = recipient.data.proposal as { kind: string; changeType: string };
    assert.equal(proposal.kind, documentation ? 'change' : 'research');
    assert.equal(proposal.changeType, documentation ? 'documentation' : 'behavior');
    assert.equal(sender.status, 'waiting');
    assert.deepEqual(sender.dependencies, [recipient.id]);
    assert.equal(recipient.data.recordId, undefined);
  }

  /** Captures a real Node-profile owner with no test-root write scope, making behavioral substitution invalid. */
  private profile(f: GeneralFixture['fixture']): void {
    const ownerPath = join(f.repo, '.arc/architecture/components/b.json');
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
    owner.testProfile = 'node';
    writeFileSync(ownerPath, JSON.stringify(owner));
    const maintenancePath = join(f.repo, '.arc/architecture/components/a.json');
    const maintenance = JSON.parse(readFileSync(maintenancePath, 'utf8'));
    maintenance.owns.push('.arc/architecture/test-profiles');
    writeFileSync(maintenancePath, JSON.stringify(maintenance));
    mkdirSync(join(f.repo, '.arc/architecture/test-profiles'), { recursive: true });
    writeFileSync(
      join(f.repo, '.arc/architecture/test-profiles/node.yaml'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'node',
        adapter: 'node',
        outputRoot: '.test-build',
        preparation: [{ operation: 'verify', purpose: 'tests' }],
        run: 'verify',
      }),
    );
    f.commit();
  }
}

for (const documentation of [false, true])
  test(`dependency admission preserves inherited ${documentation ? 'documentation' : 'research'} workflow`, (t) =>
    new RequestWorkflowScenario().run(t, documentation));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
