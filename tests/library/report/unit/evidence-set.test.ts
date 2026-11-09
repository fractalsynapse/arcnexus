import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EvidenceSet } from '../../../../dist/library/report/evidence-set.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Drives the reference-and-measure subsystem through its public capability shape. */
class SetFixture {
  readonly root: string;

  readonly set: EvidenceSet;

  /** Creates an isolated artifact store under application-shaped storage. */
  constructor(t: TestContext) {
    this.root = mkdtempSync(join(tmpdir(), 'arcnexus-evidence-set-'));
    this.set = new EvidenceSet('direction.evidence', join(this.root, 'runs', 'run-1'));
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
  }

  /** Long content with a known marker late in the artifact, so slicing is observable. */
  static long(prefix = 'line', rows = 400): string {
    return [...Array(rows)].map((_, index) => prefix + ' ' + index).join('\n') + '\nMARKER-AT-END';
  }
}

test('artifacts are advertised by reference with measured size, not as paged copies', (t) => {
  const f = new SetFixture(t);
  const content = SetFixture.long();
  f.set.add('changes', content, 'text');
  const [reference] = f.set.metadata();
  assert.ok(reference);
  assert.equal(reference.sha256, createHash('sha256').update(content).digest('hex'));
  assert.equal(reference.bytes, Buffer.byteLength(content));
  assert.equal(reference.lines, content.split('\n').length);
  assert.equal(readFileSync(reference.path, 'utf8'), content, 'the reference is the retained file');
  assert.ok(
    !(reference as unknown as Record<string, unknown>).content,
    'no body is copied into metadata',
  );
});

test('repeated reads cost what they cost and are recorded as measures', async (t) => {
  const f = new SetFixture(t);
  const content = SetFixture.long();
  f.set.add('changes', content, 'text');
  const first = (await f.set.call('direction.evidence', { artifact: 'changes' })) as {
    totalCharacters: number;
    returnedCharacters: number;
    truncated: boolean;
  };
  assert.equal(
    first.returnedCharacters,
    content.length,
    'nothing is capped: the whole artifact serves',
  );
  assert.equal(first.truncated, false);
  const slice = (await f.set.call('direction.evidence', {
    artifact: 'changes',
    offset: 5,
    length: 10,
  })) as { content: string; truncated: boolean };
  assert.equal(slice.content, content.slice(5, 15));
  assert.equal(slice.truncated, true, 'a slice says plainly that bytes remain unread');
  assert.deepEqual(f.set.measures(), {
    capability: 'direction.evidence',
    artifacts: 1,
    reads: 2,
    bytes: Buffer.byteLength(content),
  });
});

test('a retained file is adopted by reference without rewriting a byte', (t) => {
  const f = new SetFixture(t);
  const path = join(f.root, 'retained.log');
  const body = 'observed command output\n';
  writeFileSync(path, body);
  f.set.adopt('invocation-1', path, 'text');
  const [reference] = f.set.metadata();
  assert.ok(reference);
  assert.equal(reference.path, path, 'the original file stays in place');
  assert.equal(readFileSync(path, 'utf8'), body);
  assert.equal(reference.sha256, createHash('sha256').update(body).digest('hex'));
});

test('an unknown artifact id is refused rather than resolving to a filesystem path', async (t) => {
  const f = new SetFixture(t);
  f.set.add('known', 'body', 'text');
  await assert.rejects(
    () => f.set.call('direction.evidence', { artifact: '../../../etc/passwd' }),
    /Unknown evidence artifact/,
  );
  await assert.rejects(() => f.set.call('other.evidence', {}), /Unknown evidence capability/);
});

test('the manifest carries the measures so a later reader sees the cost of the loop', (t) => {
  const f = new SetFixture(t);
  f.set.add('state', '{"ready":true}', 'json');
  f.set.addSections('record', { id: 'run-1', error: 'kept', ignored: 'dropped' }, ['id', 'error']);
  const manifest = f.set.retain(join(f.root, 'runs', 'run-1'), {
    artifacts: f.set.navigation(),
  }) as {
    measures: { artifacts: number; bytes: number };
  };
  assert.equal(manifest.measures.artifacts, f.set.metadata().length);
  assert.ok(manifest.measures.bytes > 0, 'bytes are recorded, not limited');
  const written = JSON.parse(
    readFileSync(join(f.root, 'runs', 'run-1', 'evidence-manifest.json'), 'utf8'),
  ) as { measures: unknown };
  assert.deepEqual(written.measures, manifest.measures);
});

test('an aliased artifact is refused before it can be referenced or read', async (t) => {
  const f = new SetFixture(t);
  const { symlinkSync, writeFileSync: write } = await import('node:fs');
  write(join(f.root, 'elsewhere.txt'), 'other bytes');
  symlinkSync(join(f.root, 'elsewhere.txt'), join(f.root, 'alias.log'));
  assert.throws(
    () => f.set.adopt('alias', join(f.root, 'alias.log'), 'text'),
    /Unsafe evidence artifact alias/,
    'a symlink cannot be advertised as retained evidence',
  );
});

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic'] });
