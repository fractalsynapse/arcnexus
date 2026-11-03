import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { openBridge } from '../../../../dist/library/steward/bridge.js';
import { BridgePreflight } from '../../../../dist/library/steward/bridge-preflight.js';
import { CodexConfiguration } from '../../../../dist/library/steward/codex-configuration.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks production client isolation with disposable configuration, never real credentials. */
class ClientIsolationScenarios {
  /** The installed runtime must not expose a personal MCP server through the production environment. */
  async native(t: TestContext): Promise<void> {
    const fixture = this.fixture(t);
    const config = this.configuration(fixture);
    const result = spawnSync(
      process.env.ARCNEXUS_TEST_CODEX!,
      ['mcp', 'list', '--json', '-c', 'mcp_servers.arcnexus.command="/usr/bin/true"'],
      { cwd: fixture.workspace, env: config.env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const enabled = JSON.parse(result.stdout).filter((server: any) => server.enabled);
    assert.deepEqual(
      enabled.map((server: any) => server.name),
      ['arcnexus'],
    );
    assert.equal(existsSync(join(fixture.home, 'executed')), false);
    assert.equal(readFileSync(join(fixture.home, 'config.toml'), 'utf8'), fixture.personal);
    await this.preflight(config);
  }

  /** Uses the actual bridge definition and supervised inventory check without invoking a model. */
  private async preflight(config: CodexConfiguration): Promise<void> {
    const bridge = await openBridge([], async () => null);
    try {
      await new BridgePreflight(config).inspect(bridge.config);
      await new BridgePreflight(config).inspect(bridge.config);
      assert.deepEqual(config.input.record.toolPreflight, {
        status: 'passed',
        servers: ['arcnexus'],
        clientProtocol: 1,
      });
    } finally {
      await bridge.close();
    }
  }

  /** Authentication is private and configuration is neither inherited nor writable by the model. */
  privateState(t: TestContext): void {
    const fixture = this.fixture(t);
    const config = this.configuration(fixture);
    assert.notEqual(config.env.CODEX_HOME, fixture.home);
    assert.equal(config.permissions.filesystem[config.env.CODEX_HOME!], 'deny');
    assert.equal(readFileSync(join(config.env.CODEX_HOME!, 'auth.json'), 'utf8'), '{}');
    assert.equal(existsSync(join(config.env.CODEX_HOME!, 'plugins')), false);
    config.input.record.settings = { clientProtocol: 1 };
    const continuation = new CodexConfiguration({ ...config.input, resumeId: 'retained' });
    assert.equal(continuation.env.CODEX_HOME, config.env.CODEX_HOME);
    writeFileSync(join(config.env.CODEX_HOME!, 'config.toml'), 'model="altered"');
    assert.throws(() => this.configuration(fixture), /private.*configuration/i);
  }

  /** A credential alias is rejected before any private copy can read its target. */
  alias(t: TestContext): void {
    const fixture = this.fixture(t);
    rmSync(join(fixture.home, 'auth.json'));
    symlinkSync('config.toml', join(fixture.home, 'auth.json'));
    assert.throws(() => this.configuration(fixture), /unsafe private client/i);
  }

  /** Removing retained configuration cannot silently reset active client authority. */
  removed(t: TestContext): void {
    const fixture = this.fixture(t);
    const config = this.configuration(fixture);
    rmSync(join(config.env.CODEX_HOME!, 'config.toml'));
    assert.throws(() => this.configuration(fixture), /private.*configuration/i);
  }

  /** Old retained threads cannot silently acquire a different client protocol. */
  legacy(t: TestContext): void {
    const fixture = this.fixture(t);
    assert.throws(() => this.configuration(fixture, 'legacy-thread'), /legacy|private.*thread/i);
  }

  /** Constructs actual compiled runtime settings from minimal captured owner authority. */
  private configuration(
    fixture: ReturnType<ClientIsolationScenarios['fixture']>,
    resumeId?: string,
  ) {
    return new CodexConfiguration({
      root: fixture.root,
      record: this.record(fixture.workspace),
      prompt: 'Inspect only',
      executable: process.env.ARCNEXUS_TEST_CODEX ?? process.execPath,
      model: 'test',
      responseContract: 'initializer-result',
      signal: new AbortController().signal,
      resumeId,
    });
  }

  /** Supplies a minimal captured profile, independently of any personal settings. */
  private record(workspace: string): RecordData {
    return {
      id: 'run',
      workspace,
      context: [
        {
          schemaVersion: 6,
          access: { readPaths: ['.'], writeDirectories: [] },
          allowedWritePaths: [],
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
      bindings: { tools: {} },
    } as unknown as RecordData;
  }

  /** Restores the caller environment and removes only this test's disposable directories. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-client-'));
    const workspace = join(root, 'source');
    const home = join(root, 'personal');
    const previous = process.env.CODEX_HOME;
    t.after(() => {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(workspace);
    mkdirSync(home);
    const personal = '[mcp_servers.ambient]\ncommand="/usr/bin/false"\nenabled=true\n';
    writeFileSync(join(home, 'config.toml'), personal);
    writeFileSync(join(home, 'auth.json'), '{}', { mode: 0o600 });
    process.env.CODEX_HOME = home;
    assert.equal(spawnSync('git', ['init', '-q', workspace]).status, 0);
    return { root, workspace, home, personal };
  }
}

const scenarios = new ClientIsolationScenarios();

test(
  'native model configuration exposes only the assignment bridge',
  { skip: !process.env.ARCNEXUS_TEST_CODEX },
  (t) => scenarios.native(t),
);

test('private model client state excludes personal configuration and rejects changes', (t) =>
  scenarios.privateState(t));

test('legacy model threads require explicit continuation under isolated client authority', (t) =>
  scenarios.legacy(t));

test('client authentication aliases fail before reading the target', (t) => scenarios.alias(t));

test('missing retained private configuration requires attention', (t) => scenarios.removed(t));

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
