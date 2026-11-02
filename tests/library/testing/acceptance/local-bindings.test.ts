import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ComponentTesting } from '../../../../dist/library/testing/testing.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentTestFixture } from '../support/component-test-fixture.js';

/** Keeps test entry points on the same machine-bound executable authority as normal execution. */
class LocalBindingScenarios {
  /** The built CLI captures discovered bindings and their source evidence without caller options. */
  inspect(t: TestContext): void {
    const f = this.fixture(t);
    const result = f.run('inspect');
    assert.equal(result.status, 0, result.stderr);
    const selection = JSON.parse(result.stdout);
    assert.equal(selection.bindings.tools.node, realpathSync(process.execPath));
    assert.ok(selection.bindings.configurationSource.normalizedHash);
  }

  /** The npm-facing service discovers the same file, while explicit maintenance bindings take precedence. */
  precedence(t: TestContext): void {
    const f = this.fixture(t);
    const service = new ComponentTesting();
    assert.equal(service.inspect(f.repo).bindings.tools.node, realpathSync(process.execPath));
    const explicit = { schemaVersion: 1 as const, tools: {}, repositories: {} };
    assert.deepEqual(service.inspect(f.repo, {}, explicit).bindings, explicit);
  }

  /** Linked checkouts resolve the one binding file in their canonical common Git directory. */
  linked(t: TestContext): void {
    const f = this.fixture(t);
    const linked = join(f.root, 'linked');
    f.git('worktree', 'add', '--detach', linked);
    const selection = new ComponentTesting().inspect(linked);
    assert.equal(selection.bindings.tools.node, realpathSync(process.execPath));
    assert.equal(
      selection.bindings.configurationSource?.path,
      join(f.repo, '.git/arcnexus/bindings.yaml'),
    );
  }

  /** Places machine policy in Git-private storage, outside captured architectural ownership. */
  private fixture(t: TestContext): ComponentTestFixture {
    const f = new ComponentTestFixture(t);
    f.put('.git/arcnexus/bindings.yaml', {
      schemaVersion: 1,
      tools: { node: process.execPath },
      repositories: {},
    });
    return f;
  }
}

const scenarios = new LocalBindingScenarios();

test('test CLI discovers local executable bindings without options', (t) => scenarios.inspect(t));

test('test service discovers machine policy and respects explicit override', (t) =>
  scenarios.precedence(t));

test('linked worktrees share canonical machine bindings for test execution', (t) =>
  scenarios.linked(t));

registerSuite({ component: 'testing', level: 'acceptance', tags: ['deterministic'] });
