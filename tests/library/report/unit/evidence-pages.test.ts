import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EvidencePages } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises client correction without converting evidence integrity failures into ordinary responses. */
class EvidenceRequestScenarios {
  /** Rejects malformed and foreign inputs without disclosure, then serves unchanged pinned content. */
  async corrective(): Promise<void> {
    const pages = this.pages();
    for (const request of [
      null,
      [],
      'manifest',
      {},
      { artifact: 1 },
      { artifact: '' },
      { artifact: 'manifest', runId: 'foreign' },
      { artifact: '../report.json' },
      { artifact: 'supplier:edit:foreign.json' },
    ]) {
      const result = (await pages.call('verification.evidence', request)) as any;
      assert.equal(result.status, 'rejected');
      assert.equal('content' in result, false);
      assert.equal('sha256' in result, false);
      assert.match(result.recovery, /artifact=manifest/);
    }
    const page = (await pages.call('verification.evidence', { artifact: 'manifest' })) as any;
    assert.equal(page.content, '{"captured":true}');
    assert.equal(page.complete, true);
    await assert.rejects(pages.call('foreign.evidence', { artifact: 'manifest' }), /capability/);
  }

  /** Altered retained content still raises an integrity error rather than a correctable input rejection. */
  integrity(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-evidence-request-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const pages = this.pages();
    const retained = pages.retain(root, {}) as { directory: string; manifest: string };
    const path = join(retained.directory, retained.manifest);
    assert.equal(readFileSync(path, 'utf8'), '{"captured":true}');
    chmodSync(path, 0o600);
    writeFileSync(path, 'TAMPERED');
    assert.throws(() => pages.retain(root, {}), /content identity/);
  }

  /** Creates a small actual artifact rather than substituting a permissive evidence backend. */
  private pages(): EvidencePages {
    const pages = new EvidencePages('verification.evidence');
    pages.add('manifest', '{"captured":true}', 'json');
    return pages;
  }
}

const scenarios = new EvidenceRequestScenarios();

test('evidence request mistakes are correctable without exposing foreign content', () =>
  scenarios.corrective());

test('evidence request correction does not swallow retained integrity failures', (t) =>
  scenarios.integrity(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
