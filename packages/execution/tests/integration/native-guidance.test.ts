import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { verifyNativeGuidance } from '../../src/host-config.js';

/** Create a repository whose captured guidance can be compared with native discovery. */
function guidanceFixture() {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-guidance-'));
  execFileSync('git', ['init', '-q', root]);
  mkdirSync(join(root, '.agents/skills/example'), { recursive: true });
  const files: Record<string, string> = {
    'AGENTS.md': 'Captured directive\n',
    '.agents/skills/example/SKILL.md': 'Captured skill\n',
  };
  for (const [path, body] of Object.entries(files)) writeFileSync(join(root, path), body);
  const capture = {
    source: { paths: Object.keys(files), read: (path: string) => files[path] },
  } as unknown as Capture;
  return { root, capture };
}

test('native guidance validation admits captured directives and skills and refuses changes', (t) => {
  const { root, capture } = guidanceFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  verifyNativeGuidance(capture, root);
  writeFileSync(join(root, '.agents/skills/example/SKILL.md'), 'Changed skill\n');
  assert.throws(() => verifyNativeGuidance(capture, root), /Captured project guidance differs/);
});

test('native guidance validation refuses unapproved directives and target configuration', (t) => {
  const { root, capture } = guidanceFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'AGENTS.override.md'), 'Unapproved directive\n');
  assert.throws(() => verifyNativeGuidance(capture, root), /Captured project guidance differs/);
  rmSync(join(root, 'AGENTS.override.md'));
  mkdirSync(join(root, '.codex'));
  writeFileSync(join(root, '.codex/config.toml'), '');
  assert.throws(() => verifyNativeGuidance(capture, root), /Target Codex configuration/);
});
