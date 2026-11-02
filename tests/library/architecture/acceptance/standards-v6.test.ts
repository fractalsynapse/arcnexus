import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Preserves immutable shared standards when minimal component policies are inherited. */
class StandardsV6Scenarios {
  /** Projects captured artifacts once and ignores uncommitted guidance changes. */
  captures(t: TestContext): void {
    const f = this.fixture(t);
    f.put('package/docs/value.md', 'Candidate guidance must not replace authority.');
    const result = f.run('validate');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).owners.sample.standards, [
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
    if (missing) this.extend(f, 'platform', { standards: ['absent'] });
    else {
      const path = 'architecture/standards/standard.json';
      const pattern = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
      f.put(path, { ...pattern, operationIds: ['undeclared'] });
    }
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, missing ? /absent/ : /Standard check outside owner's operations/);
  }

  /** Rejects dual vocabulary rather than silently choosing one source of standards. */
  rejectsRetiredField(t: TestContext): void {
    const f = this.fixture(t);
    this.extend(f, 'platform', { patterns: [] });
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Invalid component-v6/);
  }

  /** Declares one owned pattern and inherits its identity from the platform. */
  private fixture(t: TestContext): ComponentV5Fixture {
    const f = new ComponentV5Fixture(t);
    this.upgrade(f);
    this.extend(f, 'platform', { standards: ['standard'] });
    const path = 'architecture/components/maintenance.json';
    const maintenance = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...maintenance, owns: [...maintenance.owns, 'architecture/standards'] });
    f.put('architecture/standards/standard.json', {
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

  /** Converts only authored component versions; historical fixture behavior stays available separately. */
  private upgrade(f: ComponentV5Fixture): void {
    for (const file of readdirSync(join(f.root, 'architecture/components'))) {
      const path = 'architecture/components/' + file;
      const value = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
      f.put(path, { ...value, schemaVersion: 6 });
    }
  }

  /** Updates only the intended declaration while retaining the fixture's existing execution authority. */
  private extend(f: ComponentV5Fixture, id: string, fields: object): void {
    const path = `architecture/components/${id}.json`;
    f.put(path, { ...JSON.parse(readFileSync(join(f.root, path), 'utf8')), ...fields });
  }
}

const scenarios = new StandardsV6Scenarios();

test('v6 inherited standards capture immutable artifacts', (t) => scenarios.captures(t));

test('v6 inherited standards reject missing standards', (t) => scenarios.rejects(t, true));

test('v6 standard references cannot grant undeclared operations', (t) =>
  scenarios.rejects(t, false));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });

test('v6 rejects retired pattern fields even alongside standards', (t) =>
  scenarios.rejectsRetiredField(t));
