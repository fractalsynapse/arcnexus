import assert from 'node:assert/strict';
import { test, type TestContext as TestContextType } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Keeps the retired configuration surface retired.
 *
 * Configuration carries no version, so there is nothing to upgrade in place and no `--write`
 * destination for an upgraded document. These refusals are the visible half of that decision: if
 * either ever starts succeeding, migration machinery has come back without a decision recorded.
 */
class RetiredConfigurationScenarios {
  /** `config migrate` refuses and names the reason. */
  migrate(t: TestContextType): void {
    const f = new PackageCliFixture(t);
    f.register();
    const result = f.command(f.root, 'config', 'migrate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /config migrate is retired; configuration carries no version/);
  }

  /** The write flag that only ever served migration is refused too. */
  write(t: TestContextType): void {
    const f = new PackageCliFixture(t);
    f.register();
    const result = f.command(f.root, 'config', 'get', 'workspace', '--write');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--write is retired with config migrate/);
  }
}

const scenarios = new RetiredConfigurationScenarios();

test('config migrate is retired with configuration versioning', (t) => scenarios.migrate(t));

test('the migration write flag is refused', (t) => scenarios.write(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
