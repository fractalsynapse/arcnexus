import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { OperationConfinement } from '../../../../dist/library/operations/operation-confinement.js';
import { operationEnvironment } from '../../../../dist/library/operations/environment.js';
import { execute } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises the production operation adapter against a real listening mutation endpoint. */
class SimulationConfinementScenario {
  /** Gives the operation a network grant, then proves immutable simulation mode narrows that grant. */
  async run(t: TestContext): Promise<void> {
    const { fixture, context, record, signal } = await this.prepare(t);
    const endpoint = await this.endpoint(t);
    const operation = {
      ...context.catalog.components.a!.operationPlan!.verify![0]!,
      network: true,
    };
    const adapter = await new OperationConfinement(fixture.state, record, signal).prepare(
      operation,
    );
    const script = this.script(endpoint.url);
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const log = join(fixture.state, 'network-denial.log');
    const result = await execute(command, record.workspace, log, signal, {
      processScope: true,
      fileOutput: true,
      env: adapter.environment({ ...operationEnvironment(record), SENTINEL: 'permitted' }),
    });
    assert.equal(result.exitCode, 0, readFileSync(log, 'utf8'));
    assert.match(readFileSync(log, 'utf8'), /network-denied/);
    assert.equal(endpoint.requests(), 0);
    assert.equal(fixture.git('status', '--porcelain'), '');
  }

  /** Prepares a real fixture workspace through captured shared operations before testing its narrowed network policy. */
  private async prepare(t: TestContext) {
    const fixture = new GeneralFixture(t).fixture;
    mkdirSync(join(fixture.state, 'runs'), { recursive: true });
    const context = new ExecutionContext().resolve(fixture.repo);
    const record = createWorkspace(fixture.state, {
      project: fixture.repo,
      bindings: context.bindings,
      packageId: context.packageId,
    });
    const signal = new AbortController().signal;
    record.executionEnvironment = { id: 'isolated-test', mode: 'simulation' };
    await prepareWorkspace(fixture.state, record, signal);
    return { fixture, context, record, signal };
  }

  /** Counts actual writes so a denied client request cannot be mistaken for a successful simulation. */
  private async endpoint(t: TestContext) {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.end('unexpected mutation');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return { url: `http://127.0.0.1:${address.port}`, requests: () => requests };
  }

  /** Sends the write from a descendant and requires an observed network rejection, not a timeout. */
  private script(url: string): string {
    const child = `fetch(${JSON.stringify(url)},{method:'POST',body:'forbidden',signal:AbortSignal.timeout(3000)}).then(()=>process.exit(8)).catch(e=>{if(e.name==='TimeoutError')process.exit(9);console.log('network-denied')})`;
    return `const p=require('child_process');if(process.env.GH_TOKEN||process.env.GITHUB_TOKEN)process.exit(7);const r=p.spawnSync(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'inherit'});process.exit(r.status??1)`;
  }
}

test('simulation denies network mutations from network-enabled operations and descendants', (t) =>
  new SimulationConfinementScenario().run(t));

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
