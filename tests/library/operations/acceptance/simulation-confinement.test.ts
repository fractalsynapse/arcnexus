import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { execFileSync } from 'node:child_process';
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
  async run(t: TestContext, downloads = false, tls = false): Promise<void> {
    const { fixture, context, record, signal } = await this.prepare(t);
    const endpoint = await this.endpoint(t, fixture.state, tls);
    const operation = {
      ...context.catalog.components.a!.operationPlan!.verify![0]!,
      network: downloads ? { domains: ['127.0.0.1'] } : true,
    };
    const adapter = await new OperationConfinement(fixture.state, record, signal).prepare(
      operation,
    );
    const script = this.script(endpoint.url, downloads, tls);
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const log = join(fixture.state, 'network-denial.log');
    const result = await execute(command, record.workspace, log, signal, {
      processScope: true,
      fileOutput: true,
      env: adapter.environment({
        ...operationEnvironment(record),
        SENTINEL: 'permitted',
      }),
    }).catch((error) => {
      throw new Error(readFileSync(log, 'utf8') || String(error), { cause: error });
    });
    assert.equal(result.exitCode, 0, readFileSync(log, 'utf8'));
    assert.match(readFileSync(log, 'utf8'), /network-denied/);
    assert.equal(endpoint.requests(), downloads && !tls ? 1 : 0);
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
  private async endpoint(t: TestContext, root: string, tls: boolean) {
    let requests = 0;
    const server = tls ? createSecureServer(this.certificate(root)) : createServer();
    server.on('request', (_request, response) => {
      requests++;
      response.end('controlled-read');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return {
      url: `${tls ? 'https' : 'http'}://127.0.0.1:${address.port}`,
      requests: () => requests,
    };
  }

  /** Generates a disposable certificate solely for exercising encrypted proxy method enforcement. */
  private certificate(root: string) {
    const key = join(root, 'endpoint.key'),
      cert = join(root, 'endpoint.crt');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=localhost',
        '-days',
        '1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
      ],
      { stdio: 'ignore' },
    );
    return { key: readFileSync(key), cert: readFileSync(cert) };
  }

  /** Requires real pipe input and successful subprocess status under the same deny-all network boundary. */
  private stdio(): string {
    const echo =
      "let text='';process.stdin.on('data',part=>text+=part);process.stdin.on('end',()=>process.stdout.write(text));";
    return `const echo=p.spawnSync(process.execPath,['-e',${JSON.stringify(echo)}],{input:'stdio-proof',encoding:'utf8'});if(echo.error||echo.status!==0||echo.stdout!=='stdio-proof')throw Error('Confined stdin failed: '+echo.error);const git=p.spawnSync('git',['--version'],{encoding:'utf8'});if(git.error||git.status!==0||!git.stdout.startsWith('git version'))throw Error('Confined subprocess status failed: '+git.error);`;
  }

  /** Sends the write from a descendant and requires an observed network rejection, not a timeout. */
  private script(url: string, downloads: boolean, tls: boolean): string {
    const child = `fetch(${JSON.stringify(url)},{method:'POST',body:'forbidden',signal:AbortSignal.timeout(3000)}).then(()=>process.exit(8)).catch(e=>{if(e.name==='TimeoutError')process.exit(9);console.log('network-denied')})`;
    const read = downloads
      ? `if(!${tls}){const read=p.spawnSync('curl',['--insecure','--silent','--show-error','--fail','--max-time','3',${JSON.stringify(url)}],{encoding:'utf8'});if(read.status!==0||read.stdout!=='controlled-read')throw Error('Allowed read failed: '+read.stderr);}const write=p.spawnSync('curl',['--insecure','--silent','--fail','--write-out','%{http_code}','--max-time','3','-X','POST',${JSON.stringify(url)}]);if(write.status!==22||String(write.stdout)!=='403')throw Error('Proxy did not reject mutation');const bypass=p.spawnSync('curl',['--insecure','--silent','--fail','--max-time','3','--noproxy','*','-X','POST',${JSON.stringify(url)}]);if(bypass.status!==7)throw Error('Direct connection not denied: '+bypass.status);`
      : '';
    return `const p=require('child_process');${this.stdio()}${read}if(process.env.GH_TOKEN||process.env.GITHUB_TOKEN)process.exit(7);if(${tls}){console.log('network-denied')}else{const r=p.spawnSync(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'inherit'});process.exit(r.status??1)}`;
  }
}

test('simulation denies network mutations from network-enabled operations and descendants', (t) =>
  new SimulationConfinementScenario().run(t));

test('simulation permits explicitly captured reads while denying writes and descendant proxy bypass', (t) =>
  new SimulationConfinementScenario().run(t, true));

test('simulation enforces method restrictions inside TLS and rejects direct encrypted bypass', (t) =>
  new SimulationConfinementScenario().run(t, true, true));

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
