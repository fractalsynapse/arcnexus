import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEdits } from '../../../dist/library/workspace/checked-edits.js';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Exercises the real read-only formatter command against independently owned source. */
class FormatProposalTests {
  /** Proposes exact hashed edits once while preserving other owners and all source bytes. */
  proposals(t: TestContext): void {
    const { root, original } = this.fixture(t);
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/foundation/format-proposal.mjs'), 'owned', 'owned/value.ts'],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const proposal = JSON.parse(result.stdout);
    assert.equal(typeof proposal.id, 'string');
    assert.equal(proposal.changes.length, 1);
    assert.equal(proposal.changes[0].path, 'owned/value.ts');
    assert.equal(proposal.changes[0].operation, 'update');
    assert.equal(
      proposal.changes[0].expectedSha256,
      createHash('sha256').update(original).digest('hex'),
    );
    assert.match(proposal.changes[0].content, /count: 1/);
    for (const path of ['owned/value.ts', 'other.ts', 'owned/ignored.ts'])
      assert.equal(readFileSync(join(root, path), 'utf8'), original);
  }

  /** Formatter output uses the existing authorized, idempotent edit path without bypassing hashes. */
  checked(t: TestContext): void {
    const { root } = this.fixture(t);
    const evidence = mkdtempSync(join(tmpdir(), 'arcnexus-format-edits-'));
    t.after(() => rmSync(evidence, { recursive: true, force: true }));
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/foundation/format-proposal.mjs'), 'owned'],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const proposal = JSON.parse(result.stdout);
    const edits = new CheckedEdits(root, evidence, 'captured', (path) => {
      assert.equal(path, 'owned/value.ts');
    });
    edits.apply(proposal);
    assert.equal(readFileSync(join(root, 'owned/value.ts'), 'utf8'), proposal.changes[0].content);
    edits.apply(proposal);
    const again = spawnSync(
      process.execPath,
      [resolve('scripts/foundation/format-proposal.mjs'), 'owned'],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(again.status, 0, again.stderr);
    assert.deepEqual(JSON.parse(again.stdout).changes, []);
  }

  /** Creates isolated owned and unrelated files, including ignored and unknown inputs. */
  private fixture(t: TestContext): { root: string; original: string } {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-format-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'owned'));
    const original = 'export const value={count:1}\n';
    for (const path of ['owned/value.ts', 'other.ts']) writeFileSync(join(root, path), original);
    writeFileSync(join(root, 'owned/ignored.ts'), original);
    writeFileSync(join(root, 'owned/unknown.blob'), 'opaque');
    writeFileSync(join(root, '.prettierignore'), 'owned/ignored.ts\n');
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    return { root, original };
  }
}

const suite = new FormatProposalTests();

test('formatter returns deduplicated checked proposals without mutating source', (t) =>
  suite.proposals(t));

test('formatter proposals apply through checked edits and become unchanged', (t) =>
  suite.checked(t));

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'formatting'],
});
