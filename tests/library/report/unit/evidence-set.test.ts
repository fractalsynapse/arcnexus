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
  static long(prefix = 'line', rows = 2000): string {
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
  const firstPage = (await f.set.call('direction.evidence', { artifact: 'changes' })) as {
    totalCharacters: number;
    complete: boolean;
  };
  assert.equal(firstPage.totalCharacters, content.length, 'the full size is always advertised');
  assert.equal(firstPage.complete, false, 'the default window is convenience, not a limit');
  assert.ok(firstPage.totalCharacters > 8192, 'the artifact is larger than one default page');
  const whole = (await f.set.call('direction.evidence', {
    artifact: 'changes',
    length: content.length,
  })) as { content: string; complete: boolean };
  assert.equal(whole.content, content, 'asking for everything gets everything');
  assert.equal(whole.complete, true);
  assert.deepEqual(f.set.measures(), {
    capability: 'direction.evidence',
    artifacts: 1,
    reads: 2,
    bytes: Buffer.byteLength(content),
  });
});

test('an explicit slice honors offset and length and reports where to continue', async (t) => {
  const f = new SetFixture(t);
  const content = SetFixture.long();
  f.set.add('changes', content, 'text');
  const slice = (await f.set.call('direction.evidence', {
    artifact: 'changes',
    offset: 5,
    length: 10,
  })) as { content: string; nextOffset: number | null };
  assert.equal(slice.content, content.slice(5, 15));
  assert.equal(slice.nextOffset, 15, 'a reader is told exactly where to continue');
  assert.equal(slice.content.length, 10, 'length is honored exactly');
  const atEnd = (await f.set.call('direction.evidence', {
    artifact: 'changes',
    offset: content.length,
  })) as { content: string; complete: boolean; nextOffset: number | null };
  assert.equal(atEnd.content, '', 'an offset at the end reads empty rather than failing');
  assert.equal(atEnd.complete, true);
  assert.equal(atEnd.nextOffset, null);
  const beyond = (await f.set.call('direction.evidence', {
    artifact: 'changes',
    offset: content.length + 10,
  })) as { status: string };
  assert.equal(beyond.status, 'rejected', 'an offset past the end is refused with its bounds');
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
  const refused = (await f.set.call('direction.evidence', { artifact: '../../../etc/passwd' })) as {
    status: string;
    error: string;
  };
  assert.equal(refused.status, 'rejected', 'a path is never resolved, by name or by luck');
  assert.match(refused.error, /Unknown direction artifact/);
  await assert.rejects(() => f.set.call('other.evidence', {}), /Unknown evidence capability/);
});

test('the manifest carries the measures so a later reader sees the cost of the loop', (t) => {
  const f = new SetFixture(t);
  f.set.add('state', '{"ready":true}', 'json');
  f.set.addSections('record', { id: 'run-1', error: 'kept', ignored: 'dropped' }, ['id', 'error']);
  f.set.add('manifest', JSON.stringify({ artifacts: f.set.navigation() }), 'json');
  const manifest = f.set.retain(join(f.root, 'runs', 'run-1'), {
    artifacts: f.set.navigation(),
  }) as {
    directory: string;
    manifest: string;
    measures: { artifacts: number; bytes: number };
  };
  assert.equal(manifest.measures.artifacts, f.set.metadata().length);
  assert.ok(manifest.measures.bytes > 0, 'bytes are recorded, not limited');
  const served = JSON.parse(
    readFileSync(join(manifest.directory, String(manifest.manifest)), 'utf8'),
  ) as { measures?: unknown };
  assert.equal(
    served.measures,
    undefined,
    'retained bytes are the manifest, not the measures wrapper',
  );
  assert.equal(manifest.directory, f.set.store, 'the published directory is where bytes live');
  assert.match(
    String(manifest.manifest),
    /^[a-f0-9]{64}$/,
    'the manifest keeps its content identity',
  );
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
