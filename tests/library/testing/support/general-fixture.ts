import { GeneralCatalog } from './general-catalog.js';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadProjectBindings } from '../../../../dist/library/architecture/bindings.js';
import { test, type TestContext, type TestFn, type TestOptions } from 'node:test';
import { workflowFixture, type WorkflowFixture } from './workflow-fixture.js';

/** Marks native process-scope cases explicitly skipped when invoked inside the confined test service. */
export function nativeHostTest(
  name: string,
  optionsOrRun: TestOptions | TestFn,
  run?: TestFn,
): void {
  const options = typeof optionsOrRun === 'function' ? {} : optionsOrRun;
  test(
    name,
    {
      ...options,
      skip:
        options.skip || (!process.env.ARCNEXUS_TEST_CODEX && 'Requires native-host qualification'),
    },
    typeof optionsOrRun === 'function' ? optionsOrRun : run,
  );
}

/** Captures portable catalog/store authority; native harness construction is a separate test responsibility. */
export function generalCatalogFixture(
  t: TestContext,
  beforeCleanup?: () => Promise<void>,
): WorkflowFixture {
  const fixture = workflowFixture(t, 'success', beforeCleanup);
  new GeneralCatalog(fixture).apply();
  fixture.commit();
  return fixture;
}

/** Captures a three-owner package and local executable binding for option-free CLI scenarios. */
export class GeneralFixture {
  readonly fixture: WorkflowFixture;

  hostPid?: number;

  /** Builds a committed catalog and registers host cleanup before the fixture directory disappears. */
  constructor(t: TestContext, gate?: string) {
    this.fixture = generalCatalogFixture(t, () => this.stopHost());
    const f = this.fixture;
    const native = this.harness(gate);
    mkdirSync(join(f.repo, '.git/arcnexus'), { recursive: true });
    writeFileSync(
      join(f.repo, '.git/arcnexus/bindings.yaml'),
      JSON.stringify({
        schemaVersion: 1,
        tools: { node: process.execPath, codex: f.executable, nativeCodex: native },
        repositories: {},
      }),
    );
  }

  /** Scripts model responses while delegating enforcement to the configured installed native runtime. */
  private harness(gate?: string): string {
    const f = this.fixture;
    const native =
      process.env.ARCNEXUS_TEST_CODEX ?? loadProjectBindings(process.cwd()).tools.codex;
    if (!native) throw new Error('General host tests require a configured native Codex binding');
    const module = new URL('./controlled-general.js', import.meta.url).href;
    const program = `#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
if(process.argv[2]==='sandbox') {
 const result=spawnSync(${JSON.stringify(native)},process.argv.slice(2),{stdio:'inherit'});
 process.exit(result.status ?? 1);
}
import(${JSON.stringify(module)}).then(({ControlledGeneral}) => new ControlledGeneral(${JSON.stringify(f.calls)}, ${JSON.stringify(gate)}).run());
`;
    writeFileSync(f.executable, program, { mode: 0o755 });
    return native;
  }

  /** Retains the host PID in memory so cleanup survives removal of fixture files. */
  captureHost(): void {
    const root = join(this.fixture.state, 'projects');
    const project = readdirSync(root)[0]!;
    this.hostPid = JSON.parse(readFileSync(join(root, project, 'host.json'), 'utf8')).pid;
  }

  /** Stops the owned supervisor before fixture removal, retaining evidence if its test watchdog expires. */
  private async stopHost(): Promise<void> {
    if (!this.hostPid) return;
    try {
      process.kill(this.hostPid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
      throw error;
    }
    for (let observation = 0; observation < 200; observation++) {
      try {
        const state = readFileSync(`/proc/${this.hostPid}/stat`, 'utf8').split(' ')[2];
        if (state === 'Z') return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      await delay(50);
    }
    throw new Error('Test supervisor did not stop; retained fixture: ' + this.fixture.root);
  }
}
