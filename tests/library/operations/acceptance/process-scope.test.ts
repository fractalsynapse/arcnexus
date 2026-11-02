import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { execute } from '../../../../dist/library/operations/process.js';
import { endpointClosed } from '../../../../dist/library/operations/service-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises kernel containment across detached sessions and supervisor parent loss. */
class ProcessScopeScenarios {
  /** Cancels a detached listener or observes its launcher exit without leaving an endpoint alive. */
  async command(t: TestContext, mode: 'exit' | 'cancel'): Promise<void> {
    const root = this.fixture(t);
    const controller = new AbortController();
    const pending = execute(
      this.commandDefinition(root, mode === 'exit'),
      root,
      join(root, 'command.log'),
      AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      { processScope: true },
    );
    const outcome = pending.then(
      () => 'completed',
      () => 'cancelled',
    );
    const port = await this.port(root);
    if (mode === 'cancel') controller.abort('test cancellation');
    assert.equal(await outcome, mode === 'exit' ? 'completed' : 'cancelled');
    assert.equal(await endpointClosed(port), true);
  }

  /** Losing the command caller still lets its independent supervisor kill detached descendants. */
  async parentLoss(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = pathToFileURL(resolve('dist/library/operations/process.js')).href;
    const script = `import {execute} from ${JSON.stringify(module)};await execute(${JSON.stringify(this.commandDefinition(root, false))},${JSON.stringify(root)},${JSON.stringify(join(root, 'command.log'))},new AbortController().signal,{processScope:true});`;
    writeFileSync(join(root, 'caller.mjs'), script);
    const caller = spawn(process.execPath, [join(root, 'caller.mjs')], { stdio: 'ignore' });
    t.after(() => caller.kill('SIGKILL'));
    const port = await this.port(root);
    caller.kill('SIGKILL');
    const watchdog = AbortSignal.timeout(10000);
    while (!(await endpointClosed(port))) await delay(10, undefined, { signal: watchdog });
    assert.equal(await endpointClosed(port), true);
  }

  /** Starts a new-session listener which inherits diagnostic descriptors from its launcher. */
  private commandDefinition(root: string, exit: boolean) {
    const file = join(root, 'port');
    const server = `const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>require('fs').writeFileSync(${JSON.stringify(file)},String(s.address().port)));`;
    const script = `const c=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(server)}],{detached:true,stdio:'inherit'});c.unref();const t=setInterval(()=>{if(require('fs').existsSync(${JSON.stringify(file)})&&${exit}){clearInterval(t);process.exit(0)}},10);`;
    return { command: process.execPath, args: ['-e', script] };
  }

  /** Waits only under the test watchdog; production cancellation has no execution deadline. */
  private async port(root: string): Promise<number> {
    const signal = AbortSignal.timeout(10000);
    while (!existsSync(join(root, 'port'))) await delay(10, undefined, { signal });
    return Number(readFileSync(join(root, 'port'), 'utf8'));
  }

  /** Keeps logs and endpoint announcements outside maintained repository source. */
  private fixture(t: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-process-scope-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
  }
}

const scenarios = new ProcessScopeScenarios();

const installed = { skip: !process.env.ARCNEXUS_TEST_CODEX };

test('confined process scope closes detached listeners on normal launcher exit', installed, (t) =>
  scenarios.command(t, 'exit'),
);

test('confined process scope closes detached listeners on cancellation', installed, (t) =>
  scenarios.command(t, 'cancel'),
);

test('confined process scope closes detached listeners after caller loss', installed, (t) =>
  scenarios.parentLoss(t),
);

registerSuite({ component: 'operations', level: 'acceptance', tags: ['deterministic'] });
