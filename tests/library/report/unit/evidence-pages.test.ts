import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EvidencePages } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises client correction without converting evidence integrity failures into ordinary responses. */
class EvidenceRequestScenarios {
  /** Large details stay losslessly paged while the index fits in one read and preserves missing evidence. */
  async sections(): Promise<void> {
    const pages = this.pages();
    const original = { status: 'failed', output: 'evidence'.repeat(10000), missing: null };
    const reference = pages.addSections('record', original, ['output', 'missing', 'absent']);
    const result = (await pages.call('verification.evidence', reference)) as any;
    assert.equal(result.complete, true);
    const index = JSON.parse(result.content);
    assert.equal(index.status, 'failed');
    assert.equal('absent' in index, false);
    let output = '',
      offset = 0;
    do {
      const page = (await pages.call('verification.evidence', { ...index.output, offset })) as any;
      output += page.content;
      offset = page.nextOffset;
      if (page.complete) break;
    } while (offset < JSON.stringify(original.output).length);
    assert.equal(JSON.parse(output), original.output);
    const missing = (await pages.call('verification.evidence', index.missing)) as any;
    assert.equal(missing.content, 'null');
    assert.equal(typeof original.output, 'string');
    assert.equal(pages.metadata().filter((item) => item.id === index.output.artifact).length, 1);
  }

  /** Agent-selected large reads preserve exact content and can consume the remaining artifact at once. */
  async large(): Promise<void> {
    const pages = this.pages();
    const original = 'evidence'.repeat(30000);
    pages.add('large', original, 'utf8');
    const first = (await pages.call('verification.evidence', {
      artifact: 'large',
      length: 100000,
    })) as any;
    assert.equal(first.content, original.slice(0, 100000));
    assert.equal(first.nextOffset, 100000);
    assert.equal(first.complete, false);
    const rest = (await pages.call('verification.evidence', {
      artifact: 'large',
      offset: first.nextOffset,
      length: Number.MAX_SAFE_INTEGER,
    })) as any;
    assert.equal(first.content + rest.content, original);
    assert.equal(rest.complete, true);
    assert.equal(rest.nextOffset, original.length);
    assert.equal(rest.sha256, first.sha256);
    const schema = pages.tools[0]!.inputSchema as any;
    assert.equal('maximum' in schema.properties.length, false);
    for (const length of [0, -1, 1.5, '100000', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const result = (await pages.call('verification.evidence', {
        artifact: 'large',
        length,
      })) as any;
      assert.equal(result.status, 'rejected');
    }
  }

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

test('evidence reads have no artificial page size ceiling', () => scenarios.large());

test('section indexes keep large evidence available without inline duplication', () =>
  scenarios.sections());

test('evidence request mistakes are correctable without exposing foreign content', () =>
  scenarios.corrective());

test('evidence request correction does not swallow retained integrity failures', (t) =>
  scenarios.integrity(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
