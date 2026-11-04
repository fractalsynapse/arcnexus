import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import YAML from 'yaml';
import { loadCatalog } from '../../../dist/library/architecture/components.js';
import { loadProjectBindings } from '../../../dist/library/architecture/bindings.js';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Qualifies this repository's authored quality policy without imposing it on generic target packages. */
class RepositoryQualityPolicyScenarios {
  private readonly ids = ['migrated-recipe-43b539fb85a57c26', 'migrated-recipe-df6d67ddacf5bf0c'];

  /** Every real executable steward inherits both finite mandatory quality checks exactly once. */
  inherited(): void {
    const source = resolve('.');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: source,
      encoding: 'utf8',
    }).trim();
    const catalog = loadCatalog(source, base, loadProjectBindings(source));
    const owners = Object.values(catalog.components).filter(
      (c) => !['platform', 'package'].includes(c.type),
    );
    assert.ok(owners.some((owner) => owner.id === 'publisher'));
    for (const owner of owners) {
      for (const id of this.ids) {
        const checks = owner.verification.filter((check) => (check as any).id === id);
        assert.equal(checks.length, 1, owner.id + ' must inherit ' + id + ' once');
        assert.equal((checks[0] as any).category, 'lint');
        assert.equal((checks[0] as any).kind, 'command');
      }
    }
  }

  /** Required shared usages have one authored source rather than repeated leaf declarations. */
  authored(): void {
    const directory = resolve('architecture/components');
    for (const file of readdirSync(directory).filter((file) => file.endsWith('.yaml'))) {
      const component = YAML.parse(readFileSync(join(directory, file), 'utf8'));
      for (const id of this.ids) {
        if (component.id === 'arcnexus') assert.deepEqual(component.operations[id], ['verify']);
        else
          assert.equal(component.operations?.[id], undefined, component.id + ' duplicates ' + id);
      }
    }
  }
}

const scenarios = new RepositoryQualityPolicyScenarios();

test('actual ArcNexus stewards inherit mandatory source quality before regression freezing', () =>
  scenarios.inherited());

test('ArcNexus shared quality usages are authored once at the platform', () =>
  scenarios.authored());

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'self-development'],
});
