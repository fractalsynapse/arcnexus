import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentFixture } from '../support/component-fixture.js';

/** Preserves immutable shared standards when minimal component policies are inherited. */
class PatternScenarios {
  /** Projects captured artifacts once and ignores uncommitted guidance changes. */
  captures(t: TestContext): void {
    const f = this.fixture(t);
    f.put('package/docs/value.md', 'Candidate guidance must not replace authority.');
    const result = f.run('validate');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).owners.sample.patterns, [
      {
        id: 'standard',
        artifacts: [
          {
            path: 'package/docs/value.md',
            sha256: createHash('sha256').update('Value is one.').digest('hex'),
          },
        ],
      },
    ]);
  }

  /** Rejects unresolved inherited identities and checks outside the declared pattern owner's usages. */
  rejects(t: TestContext, missing: boolean): void {
    const f = this.fixture(t);
    if (missing) this.extend(f, 'platform', { patterns: ['absent'] });
    else {
      const path = 'architecture/patterns/standard.json';
      const pattern = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
      f.put(path, { ...pattern, operationIds: ['undeclared'] });
    }
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, missing ? /absent/ : /Pattern check outside owner's operations/);
  }

  /** Declares one owned pattern and inherits its identity from the platform. */
  private fixture(t: TestContext): ComponentFixture {
    const f = new ComponentFixture(t);
    this.extend(f, 'platform', { patterns: ['standard'] });
    const path = 'architecture/components/maintenance.json';
    const maintenance = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...maintenance, owns: [...maintenance.owns, 'architecture/patterns'] });
    f.put('architecture/patterns/standard.json', {
      schemaVersion: 1,
      id: 'standard',
      owner: 'sample',
      purpose: 'Keep captured guidance',
      applicability: 'Owned implementation',
      document: 'docs/value.md',
      examples: [],
      operationIds: [],
    });
    f.commit();
    return f;
  }

  /** Updates only the intended declaration while retaining the fixture's existing execution authority. */
  private extend(f: ComponentFixture, id: string, fields: object): void {
    const path = `architecture/components/${id}.json`;
    f.put(path, { ...JSON.parse(readFileSync(join(f.root, path), 'utf8')), ...fields });
  }
}

const scenarios = new PatternScenarios();

test('inherited patterns capture immutable artifacts', (t) => scenarios.captures(t));

test('inherited patterns reject missing standards', (t) => scenarios.rejects(t, true));

test('pattern references cannot grant undeclared operations', (t) => scenarios.rejects(t, false));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
