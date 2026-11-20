import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

export const suite = { owner: 'foundation', level: 'unit', tags: ['regression'] } as const;

const checker = fileURLToPath(new URL('../../scripts/check-specification.js', import.meta.url));

test('the specification check rejects tracked JavaScript before validating the catalog', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'arcnexus-specification-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd });
  writeFileSync(join(cwd, 'bootstrap.cjs'), '');
  execFileSync('git', ['add', '--force', '--', 'bootstrap.cjs'], { cwd });

  const result = spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use strict TypeScript \(\.ts\) for tracked code: bootstrap\.cjs/);
});
