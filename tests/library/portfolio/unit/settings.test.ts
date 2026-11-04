import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ApplicationSettings } from '../../../../dist/library/portfolio/portfolio.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises application revision checks through actual JSON persistence and SQLite mutation ownership. */
class SettingsScenarios {
  /** Unchanged resource reads provide stable tokens without creating configuration storage. */
  reads(t: TestContext): void {
    const f = this.fixture(t);
    const settings = new ApplicationSettings();
    const first = settings.get('volume');
    assert.match(first.revision, /^[a-f0-9]{64}$/);
    assert.deepEqual(settings.get('volume'), first);
    assert.equal(existsSync(f.configuration), false);
  }

  /** Two clients cannot overwrite an intervening setting change using the same observed revision. */
  stale(t: TestContext): void {
    const f = this.fixture(t);
    const first = new ApplicationSettings();
    const second = new ApplicationSettings();
    const original = first.get('volume');
    const updated = first.update('volume', join(f.root, 'one'), original.revision);
    assert.notEqual(updated.revision, original.revision);
    const bytes = readFileSync(f.path);
    assert.throws(
      () => second.update('volume', join(f.root, 'two'), original.revision),
      /revision changed/,
    );
    assert.deepEqual(readFileSync(f.path), bytes);
    const next = second.update('volume', join(f.root, 'two'), updated.revision);
    assert.equal(next.value, join(f.root, 'two'));
    assert.equal(second.update('volume', next.value, next.revision).revision, next.revision);
  }

  /** An overlapping writer is rejected before changing JSON, then proceeds after the OS lease closes. */
  exclusive(t: TestContext): void {
    const f = this.fixture(t);
    const settings = new ApplicationSettings();
    const original = settings.update('volume', join(f.root, 'one'));
    const lease = new ExecutionLease(f.path + '.lease.sqlite');
    try {
      assert.throws(
        () => settings.update('volume', join(f.root, 'two'), original.revision),
        /settings are being updated/,
      );
      assert.equal(settings.get('volume').revision, original.revision);
    } finally {
      lease.close();
    }
    assert.equal(
      settings.update('volume', join(f.root, 'two'), original.revision).value,
      join(f.root, 'two'),
    );
  }

  /** Environment overrides remain visible while hidden persisted changes still invalidate stale tokens. */
  environment(t: TestContext): void {
    const f = this.fixture(t);
    const settings = new ApplicationSettings();
    process.env.ARCNEXUS_VOLUME = join(f.root, 'override');
    const original = settings.get('volume');
    const updated = settings.update('volume', join(f.root, 'configured'), original.revision);
    assert.equal(updated.value, original.value);
    assert.equal(updated.source, 'environment');
    assert.notEqual(updated.revision, original.revision);
    assert.equal(updated.configuredValue, join(f.root, 'configured'));
    process.env.ARCNEXUS_VOLUME = ' ';
    const bytes = readFileSync(f.path);
    assert.throws(() => settings.update('volume', join(f.root, 'invalid')), /ARCNEXUS_VOLUME/);
    assert.deepEqual(readFileSync(f.path), bytes);
    delete process.env.ARCNEXUS_VOLUME;
    assert.equal(settings.get('volume').value, updated.configuredValue);
    assert.equal(settings.get('volume').source, 'configuration');
  }

  /** Isolates machine settings without changing caller configuration or requiring a source repository. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'application-settings-'));
    const previous = {
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      ARCNEXUS_VOLUME: process.env.ARCNEXUS_VOLUME,
    };
    t.after(() => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      rmSync(root, { recursive: true, force: true });
    });
    const configuration = join(root, 'configuration');
    process.env.XDG_CONFIG_HOME = configuration;
    delete process.env.ARCNEXUS_VOLUME;
    return { root, configuration, path: join(configuration, 'arcnexus/config.json') };
  }
}

const scenarios = new SettingsScenarios();

test('application settings expose stable revision tokens without write-on-read', (t) =>
  scenarios.reads(t));

test('application settings reject stale updates without partial replacement', (t) =>
  scenarios.stale(t));

test('application settings mutations hold exclusive persistence ownership', (t) =>
  scenarios.exclusive(t));

test('application setting revisions include environment and configured value changes', (t) =>
  scenarios.environment(t));

registerSuite({ component: 'portfolio', level: 'unit', tags: ['deterministic'] });
