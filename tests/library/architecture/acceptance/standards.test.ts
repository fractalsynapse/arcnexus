import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentFixture } from '../support/component-fixture.js';

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
      const path = '.arc/architecture/standards/standard.json';
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
    assert.match(result.stderr, /Invalid component/);
  }

  /** Declares one owned pattern and inherits its identity from the platform. */
  private fixture(t: TestContext): ComponentFixture {
    const f = new ComponentFixture(t);
    this.upgrade(f);
    this.extend(f, 'platform', { standards: ['standard'] });
    const path = '.arc/architecture/components/maintenance.json';
    const maintenance = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...maintenance, owns: [...maintenance.owns] });
    f.put('.arc/architecture/standards/standard.json', {
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
  private upgrade(f: ComponentFixture): void {
    for (const file of readdirSync(join(f.root, '.arc/architecture/components'))) {
      const path = '.arc/architecture/components/' + file;
      const value = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
      f.put(path, { ...value, schemaVersion: 6 });
    }
  }

  /** Updates only the intended declaration while retaining the fixture's existing execution authority. */
  private extend(f: ComponentFixture, id: string, fields: object): void {
    const path = `.arc/architecture/components/${id}.json`;
    f.put(path, { ...JSON.parse(readFileSync(join(f.root, path), 'utf8')), ...fields });
  }
}

const scenarios = new StandardsV6Scenarios();

test('inherited standards capture immutable artifacts', (t) => scenarios.captures(t));

test('inherited standards reject missing standards', (t) => scenarios.rejects(t, true));

test('standard references cannot grant undeclared operations', (t) => scenarios.rejects(t, false));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });

test('rejects retired pattern fields even alongside standards', (t) =>
  scenarios.rejectsRetiredField(t));
