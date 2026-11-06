import type { CodexConfiguration } from '../../../../dist/library/steward/codex-configuration.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Qualifies the model's exact checked permission profile without using real credentials or inference. */
class CheckedPermissionScenarios {
  /** Agent commands cannot mutate source or access the native host's configuration storage. */
  async protects(t: TestContext): Promise<void> {
    const { root, workspace, home } = this.fixture(t);
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = home;
    try {
      const { CodexConfiguration } = await import(
        resolve('dist/library/steward/codex-configuration.js')
      );
      const configuration = new CodexConfiguration({
        root,
        record: this.record(workspace),
        prompt: 'Read only',
        executable: process.env.ARCNEXUS_TEST_CODEX!,
        model: 'test',
        responseContract: 'initializer-result',
        signal: new AbortController().signal,
      });
      writeFileSync(join(configuration.env.CODEX_HOME!, 'canary'), 'private-client');
      this.probe(configuration, workspace);
      assert.equal(readFileSync(join(workspace, 'source.txt'), 'utf8'), 'original');
      assert.equal(readFileSync(join(home, 'canary'), 'utf8'), 'private');
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  }

  /** Executes only disposable canary attempts through the exact assembled permission settings. */
  private probe(configuration: CodexConfiguration, workspace: string): void {
    const args = ['sandbox', '-P', 'arcnexus', '-C', workspace];
    for (const override of configuration.permissions.configOverrides) args.push('-c', override);
    const result = spawnSync(
      process.env.ARCNEXUS_TEST_CODEX!,
      [...args, '--', process.execPath, '-e', this.script()],
      { cwd: workspace, env: configuration.env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  }

  /** Supplies a captured minimal owner and the initializer contract without an external model call. */
  private record(workspace: string): RecordData {
    return {
      id: 'run',
      workspace,
      context: [
        {
          schemaVersion: 6,
          access: { readPaths: ['.'], writeDirectories: [] },
          allowedWritePaths: ['source.txt'],
        },
      ],
      resolvedAssignment: {
        executionProfile: {
          schemaVersion: 3,
          id: 'test',
          model: 'test',
          reasoning: 'medium',
          webSearch: 'disabled',
          operationCategories: [],
        },
      },
      turns: [],
      commands: [],
      bindings: { tools: { codex: process.env.ARCNEXUS_TEST_CODEX!, node: process.execPath } },
    } as unknown as RecordData;
  }

  /** Uses disposable source and private configuration canaries with no authentication data. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-checked-model-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const workspace = join(root, 'source');
    const home = join(root, 'native-home');
    mkdirSync(workspace);
    mkdirSync(home);
    writeFileSync(join(workspace, 'source.txt'), 'original');
    writeFileSync(join(home, 'canary'), 'private');
    assert.equal(spawnSync('git', ['init', '-q', workspace]).status, 0);
    assert.equal(spawnSync('git', ['-C', workspace, 'add', '.']).status, 0);
    return { root, workspace, home };
  }

  /** Gives each prohibited access its own nonzero failure code and checks actual denial errors. */
  private script(): string {
    return (
      "const f=require('fs');const denied=(fn,code)=>{try{fn();process.exit(code)}catch(e){if(!['EROFS','EPERM','EACCES','ENOENT'].includes(e.code))throw e;}};" +
      "denied(()=>f.writeFileSync('source.txt','bad'),7);" +
      "denied(()=>f.writeFileSync(process.env.CODEX_HOME+'/canary','bad'),8);" +
      "denied(()=>f.readFileSync(process.env.CODEX_HOME+'/canary'),9);"
    );
  }
}

const scenarios = new CheckedPermissionScenarios();

test(
  'checked model permissions protect source and native configuration authority',
  { skip: !process.env.ARCNEXUS_TEST_CODEX },
  (t) => scenarios.protects(t),
);

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
