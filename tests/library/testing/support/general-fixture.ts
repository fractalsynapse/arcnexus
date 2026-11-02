import { mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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

/** Captures a three-owner package and local executable binding for option-free CLI scenarios. */
export class GeneralFixture {
  readonly fixture: WorkflowFixture;

  hostPid?: number;

  /** Builds a committed catalog and registers host cleanup before the fixture directory disappears. */
  constructor(t: TestContext, gate?: string) {
    this.fixture = workflowFixture(t);
    const f = this.fixture;
    this.catalog();
    const native = this.harness(gate);
    mkdirSync(join(f.repo, '.git/arcnexus'), { recursive: true });
    writeFileSync(
      join(f.repo, '.git/arcnexus/bindings.yaml'),
      JSON.stringify({
        schemaVersion: 1,
        tools: { codex: f.executable, nativeCodex: native },
        repositories: {},
      }),
    );
    f.commit();
    t.after(() => this.stopHost());
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

  /** Replaces obsolete overlapping fixture authority with three disjoint minimal owners. */
  private catalog(): void {
    const f = this.fixture;
    for (const id of ['sample', 'dependency'])
      rmSync(join(f.repo, `architecture/components/${id}.json`));
    for (const id of ['a', 'b', 'c']) {
      const owns = id === 'a' ? this.maintenance() : [id];
      writeFileSync(
        join(f.repo, `architecture/components/${id}.json`),
        JSON.stringify({
          schemaVersion: 6,
          id,
          type: 'library',
          parentId: 'package',
          purpose: `Own ${id} responsibilities`,
          owns,
        }),
      );
    }
    this.package();
    this.profiles();
    this.operations();
    this.composition();
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
  }

  /** Assigns shared scaffold maintenance to one executable owner, excluding its implicit definition. */
  private maintenance(): string[] {
    return [
      'source.txt',
      'docs',
      'tests',
      'new.txt',
      '.gitignore',
      'verify.cjs',
      'architecture/environment.yaml',
      'architecture/roles',
      'architecture/execution-profiles',
      'architecture/operations',
      'architecture/components/platform.json',
      'architecture/components/package.json',
    ];
  }

  /** Captures inherited policies once and keeps the package a context container. */
  private package(): void {
    const definitions = {
      platform: {
        schemaVersion: 6,
        id: 'platform',
        type: 'platform',
        purpose: 'Controlled host acceptance',
        role: 'engineer',
        executionProfile: 'luna',
        reads: ['.'],
        constraints: ['No commits'],
        operations: { verify: ['verify'] },
        director: { component: 'a', profile: 'luna' },
        reviewerProfile: 'luna',
        defaultPackage: 'package',
      },
      package: {
        schemaVersion: 6,
        id: 'package',
        type: 'package',
        parentId: 'platform',
        purpose: 'Supply three independent test owners',
      },
    };
    for (const [id, definition] of Object.entries(definitions))
      writeFileSync(
        join(this.fixture.repo, `architecture/components/${id}.json`),
        JSON.stringify(definition),
      );
  }

  /** Selects a no-budget profile shared by scripted engineering and independent review. */
  private profiles(): void {
    writeFileSync(
      join(this.fixture.repo, 'architecture/execution-profiles/luna.yaml'),
      JSON.stringify({
        schemaVersion: 3,
        id: 'luna',
        model: 'gpt-6-luna',
        reasoning: 'medium',
        webSearch: 'disabled',
        operationCategories: ['cli-check'],
      }),
    );
  }

  /** Declares one finite host check and composition without inline executable recipes. */
  private operations(): void {
    const f = this.fixture;
    mkdirSync(join(f.repo, 'architecture/operations'), { recursive: true });
    writeFileSync(
      join(f.repo, 'architecture/operations/verify.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        id: 'verify',
        purpose: 'Observe the captured fixture contract',
        repository: 'sample',
        cwd: '.',
        category: 'cli-check',
        kind: 'command',
        command: 'node',
        args: ['verify.cjs'],
        activities: [],
        generatedDirectories: [],
        artifacts: [],
        prerequisites: [],
      }),
    );
  }

  /** Captures repository composition independently of executable operation recipes. */
  private composition(): void {
    const f = this.fixture;
    writeFileSync(
      join(f.repo, 'architecture/environment.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        workspace: {
          primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
          dependencies: [],
        },
      }),
    );
  }

  /** Retains the host PID in memory so cleanup survives removal of fixture files. */
  captureHost(): void {
    const root = join(this.fixture.state, 'projects');
    const project = readdirSync(root)[0]!;
    this.hostPid = JSON.parse(readFileSync(join(root, project, 'host.json'), 'utf8')).pid;
  }

  /** Stops the detached test host so no managed process survives its disposable repository. */
  private stopHost(): void {
    if (!this.hostPid) return;
    try {
      process.kill(this.hostPid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
  }
}
