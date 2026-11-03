import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { endpointClosed, processStart } from '../../../../dist/library/operations/service-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks model-supervisor lifetime independently of model output or external inference availability. */
class ContainedSupervisorScenarios {
  /** Normal exit and hard host loss both close detached listeners behind the model launcher. */
  async run(t: TestContext, parentLoss = false): Promise<void> {
    const root = this.fixture(t, parentLoss);
    const child = this.launch(root, parentLoss);
    t.after(() => child.kill('SIGKILL'));
    const endpoint = await this.endpoint(root);
    if (parentLoss) child.kill('SIGKILL');
    const watchdog = AbortSignal.timeout(5000);
    while (!(await endpointClosed(endpoint.port))) await delay(10, undefined, { signal: watchdog });
    assert.equal(await endpointClosed(endpoint.port), true);
    const scope = JSON.parse(readFileSync(join(root, 'codex.pid.scope.json'), 'utf8'));
    while (existsSync(scope.path)) await delay(10, undefined, { signal: watchdog });
  }

  /** Supplies a controlled executable that creates a detached HTTP listener before exiting or waiting. */
  private fixture(t: TestContext, hold: boolean): string {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-model-scope-'));
    t.after(() => this.cleanup(root));
    const endpoint = join(root, 'endpoint.json');
    const server = `const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>require('fs').writeFileSync(${JSON.stringify(endpoint)},JSON.stringify({pid:process.pid,port:s.address().port})));`;
    const script = `#!/usr/bin/node\nconst c=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(server)}],{detached:true,stdio:'inherit'});c.unref();setInterval(()=>{if(require('fs').existsSync(${JSON.stringify(endpoint)})&&!${hold})process.exit(0)},10);`;
    writeFileSync(join(root, 'fake-codex'), script);
    chmodSync(join(root, 'fake-codex'), 0o700);
    return root;
  }

  /** Launches the built supervisor under either the test host or a separately killable driver. */
  private launch(root: string, driver: boolean): ChildProcess {
    const supervisor = resolve('dist/library/steward/codex-supervisor.js');
    const env = {
      ...process.env,
      ARCNEXUS_CONFINED_SCOPE: '1',
      ARCNEXUS_CODEX_EXECUTABLE: join(root, 'fake-codex'),
      ARCNEXUS_CODEX_PID: join(root, 'codex.pid'),
      ARCNEXUS_HOST_PID: String(process.pid),
      ARCNEXUS_HOST_START: processStart(process.pid)!,
    };
    if (!driver)
      return spawn(process.execPath, [supervisor, 'exec'], { cwd: root, env, stdio: 'ignore' });
    const module = pathToFileURL(resolve('dist/library/operations/service-state.js')).href;
    const script = `import {spawn} from 'node:child_process';import {processStart} from ${JSON.stringify(module)};spawn(process.execPath,[${JSON.stringify(supervisor)},'exec'],{stdio:'ignore',env:{...process.env,ARCNEXUS_HOST_PID:String(process.pid),ARCNEXUS_HOST_START:processStart(process.pid)}});setInterval(()=>{},1000);`;
    writeFileSync(join(root, 'driver.mjs'), script);
    return spawn(process.execPath, [join(root, 'driver.mjs')], { cwd: root, env, stdio: 'ignore' });
  }

  /** Waits for the actual listener announcement under an explicit test watchdog. */
  private async endpoint(root: string): Promise<{ pid: number; port: number }> {
    const signal = AbortSignal.timeout(5000);
    while (!existsSync(join(root, 'endpoint.json'))) await delay(10, undefined, { signal });
    return JSON.parse(readFileSync(join(root, 'endpoint.json'), 'utf8'));
  }

  /** Cleans up only a failed test's positively identified disposable process group. */
  private cleanup(root: string): void {
    if (existsSync(join(root, 'endpoint.json'))) {
      const { pid } = JSON.parse(readFileSync(join(root, 'endpoint.json'), 'utf8'));
      try {
        if (realpathSync(`/proc/${pid}/cwd`) === root) process.kill(-pid, 'SIGKILL');
      } catch {
        /* Successful containment has already removed the process. */
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}

const scenarios = new ContainedSupervisorScenarios();

const installed = { skip: !process.env.ARCNEXUS_TEST_CODEX };

test('checked-edit model supervisor contains detached work after normal exit', installed, (t) =>
  scenarios.run(t),
);

test('checked-edit model supervisor contains detached work after host loss', installed, (t) =>
  scenarios.run(t, true),
);

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
