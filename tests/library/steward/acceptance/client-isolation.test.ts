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
  /** Host substitutions cover role and activity turns without changing captured authority or worker settings. */
  substitutions(t: TestContext): void {
    const prior = process.env.ARCNEXUS_MODEL_SUBSTITUTIONS;
    t.after(() => {
      if (prior === undefined) delete process.env.ARCNEXUS_MODEL_SUBSTITUTIONS;
      else process.env.ARCNEXUS_MODEL_SUBSTITUTIONS = prior;
    });
    const base = this.configuration(this.fixture(t));
    base.input.record.settings = base.settings;
    process.env.ARCNEXUS_MODEL_SUBSTITUTIONS = '{"test":"replacement"}';
    for (const activity of [undefined, 'research', 'review']) {
      const selected = new CodexConfiguration({ ...base.input, activity, resumeId: 'retained' });
      assert.equal(selected.settings.model, 'replacement');
      assert.equal(selected.settings.requestedModel, 'test');
      assert.deepEqual(selected.permissions, base.permissions);
      assert.equal(selected.env.ARCNEXUS_MODEL_SUBSTITUTIONS, undefined);
      assert.equal(selected.profile.model, 'test');
    }
    process.env.ARCNEXUS_MODEL_SUBSTITUTIONS = '{"different":"replacement"}';
    assert.equal(new CodexConfiguration(base.input).settings.model, 'test');
    for (const invalid of ['null', '[]', 'false', '{', '{"test":3}', '{"test":""}']) {
      process.env.ARCNEXUS_MODEL_SUBSTITUTIONS = invalid;
      assert.throws(() => new CodexConfiguration(base.input), /MODEL_SUBSTITUTIONS/);
    }
  }

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

  /** Continuation selects captured activity settings without replacing the default or reviewer profile. */
  activityProfiles(t: TestContext): void {
    const fixture = this.fixture(t);
    const base = this.configuration(fixture);
    const resolved = base.input.record.resolvedAssignment as any;
    resolved.activityProfiles = {
      research: {
        ...resolved.executionProfile,
        id: 'research',
        model: 'research-model',
        reasoning: 'high',
      },
    };
    base.input.record.settings = base.settings;
    const research = new CodexConfiguration({
      ...base.input,
      activity: 'research',
      resumeId: 'retained',
    });
    assert.equal(research.settings.model, 'research-model');
    assert.equal(research.settings.reasoning, 'high');
    assert.equal(research.settings.executionProfile, 'research');
    const fallback = new CodexConfiguration({ ...base.input, activity: 'implementation' });
    assert.equal(fallback.settings.model, 'test');
    assert.equal(resolved.executionProfile.id, 'test');
    assert.equal(new CodexConfiguration(base.input).settings.executionProfile, 'test');
  }

  /** Existing captured runs without activity policy keep their explicit default settings. */
  legacyProfiles(t: TestContext): void {
    const base = this.configuration(this.fixture(t));
    const research = new CodexConfiguration({ ...base.input, activity: 'research' });
    assert.equal(research.settings.model, base.settings.model);
    assert.equal(research.settings.executionProfile, base.settings.executionProfile);
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

  /** Misconfigured runtime storage cannot copy host credentials into maintained source. */
  sourceStorage(t: TestContext): void {
    const fixture = this.fixture(t);
    assert.throws(
      () => this.configuration({ ...fixture, root: fixture.workspace }),
      /private.*source/i,
    );
    assert.equal(existsSync(join(fixture.workspace, 'private')), false);
  }

  /** Assignments share refreshed private authentication without copying the caller file again. */
  shared(t: TestContext): void {
    const fixture = this.fixture(t);
    const config = this.configuration(fixture);
    writeFileSync(join(config.env.CODEX_HOME!, 'auth.json'), '{"refreshed":true}');
    const next = new CodexConfiguration({
      ...config.input,
      record: { ...config.input.record, id: 'another-assignment' },
    });
    assert.equal(next.env.CODEX_HOME, config.env.CODEX_HOME);
    assert.equal(
      readFileSync(join(next.env.CODEX_HOME!, 'auth.json'), 'utf8'),
      '{"refreshed":true}',
    );
    assert.equal(readFileSync(join(fixture.home, 'auth.json'), 'utf8'), '{}');
  }

  /** An existing private credential store never silently switches to another caller identity. */
  identity(t: TestContext): void {
    const fixture = this.fixture(t);
    this.configuration(fixture);
    const other = join(fixture.root, 'other-identity');
    mkdirSync(other);
    process.env.CODEX_HOME = other;
    assert.throws(() => this.configuration(fixture), /authentication binding changed/i);
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

test('host model substitutions preserve captured authority and record effective selection', (t) =>
  scenarios.substitutions(t));

test('captured runs without overrides retain their model policy', (t) =>
  scenarios.legacyProfiles(t));

test('model turns select captured activity profiles on retained threads and preserve fallback', (t) =>
  scenarios.activityProfiles(t));

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

test('private client storage rejects source overlap before copying credentials', (t) =>
  scenarios.sourceStorage(t));

test('assignments retain shared private authentication without reseeding it', (t) =>
  scenarios.shared(t));

test('changing authentication identity requires separate private runtime state', (t) =>
  scenarios.identity(t));

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
