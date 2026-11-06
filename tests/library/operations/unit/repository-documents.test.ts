import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { RepositoryDocuments } from '../../../../dist/library/operations/repository-documents.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises committed repository formats without credentials or model execution. */
class RepositoryDocumentScenarios {
  /** Template ordering and provenance come from committed source, not editable worker files. */
  captured(t: TestContext): void {
    const f = this.fixture(
      t,
      'work.md',
      '---\nname: Work\nabout: Change\n---\n## Scope\n\n<!-- Fill -->\n## Summary\n',
    );
    const document = f.documents.prepare('issue', 'Fix\nreader behavior', {
      Summary: 'Readable goal',
      Scope: '- Checked edits',
    });
    assert.equal(document.body, '## Scope\n\n- Checked edits\n\n## Summary\n\nReadable goal');
    assert.equal(document.title, 'Fix reader behavior');
    f.documents.validateIssue(document.body);
    assert.throws(
      () => f.documents.validateIssue('Raw runtime payload'),
      /requires repository template sections/,
    );
    assert.equal(document.template?.path, '.github/ISSUE_TEMPLATE/work.md');
    writeFileSync(join(f.repo, '.github/ISSUE_TEMPLATE/work.md'), '## Worker override\n');
    assert.equal(
      f.documents.prepare('issue', 'Title', { Scope: 'Scope', Summary: 'Summary' }).template
        ?.sha256,
      document.template?.sha256,
    );
    assert.throws(
      () => f.documents.prepare('issue', 'Title', { Summary: 'Only summary' }),
      /section requires content: Scope/,
    );
  }

  /** Ambiguous templates and unsupported issue forms require a choice rather than silent guessing. */
  unsupported(t: TestContext): void {
    const f = this.fixture(t, 'work.yml', 'name: Work\nbody: []\n');
    assert.throws(() => f.documents.prepare('issue', 'Title', {}), /issue forms/);
    writeFileSync(join(f.repo, '.github/ISSUE_TEMPLATE/second.md'), '## Summary\n');
    f.commit();
    const documents = new RepositoryDocuments(f.repo, f.git('rev-parse', 'HEAD'));
    assert.throws(() => documents.prepare('issue', 'Title', {}), /Multiple repository templates/);
  }

  /** Projects supplied facts as Markdown when the repository has no template. */
  absent(t: TestContext): void {
    const f = workflowFixture(t);
    const documents = new RepositoryDocuments(f.repo, f.git('rev-parse', 'HEAD'));
    const result = documents.prepare('pull-request', 'Correct retry behavior', {
      Summary: 'Cancelled attempts can be retried.',
      Verification: 'Observed regression passed.',
    });
    assert.match(result.body, /^## Summary\n/);
    assert.match(result.body, /## Verification\n\nObserved regression passed/);
    assert.equal(result.template, undefined);
  }

  /** Creates a real Git template revision with ordinary temporary repository cleanup. */
  private fixture(t: TestContext, name: string, content: string) {
    const f = workflowFixture(t);
    mkdirSync(join(f.repo, '.github/ISSUE_TEMPLATE'), { recursive: true });
    writeFileSync(join(f.repo, '.github/ISSUE_TEMPLATE', name), content);
    f.commit();
    return { ...f, documents: new RepositoryDocuments(f.repo, f.git('rev-parse', 'HEAD')) };
  }
}

const scenarios = new RepositoryDocumentScenarios();

test('collaboration documents follow the committed repository template', (t) =>
  scenarios.captured(t));

test('ambiguous and unsupported templates fail explicitly', (t) => scenarios.unsupported(t));

test('repositories without templates receive readable Markdown', (t) => scenarios.absent(t));

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic', 'collaboration'] });
