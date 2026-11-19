import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { textDigest } from '../../../foundation/src/index.js';
import { openProject } from '../../src/source.js';

export const suite = { owner: 'architecture', level: 'unit', tags: ['evidence'] } as const;

/** Capture complete committed source without inheriting user Git settings or buffer ceilings. */
class CompleteSource {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-complete-source-'));
  private readonly options = {
    cwd: this.root,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
  };

  /** Keep the fixture local and arrange cleanup even when a setup command fails. */
  constructor(t: TestContext, content: string) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q'], this.options);
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'https://example.com/project.git'],
      this.options,
    );
    writeFileSync(join(this.root, 'source.txt'), content);
    execFileSync('git', ['add', 'source.txt'], this.options);
    execFileSync('git', ['commit', '-qm', 'Complete source'], this.options);
  }
}

test('captured source preserves complete large committed files beyond the process default buffer', (t) => {
  const content = 'Complete committed definition.\n'.repeat(100_000);
  const scenario = new CompleteSource(t, content);
  const observed = openProject(scenario.root).read('source.txt');
  assert.equal(observed.length, content.length);
  assert.equal(textDigest(observed), textDigest(content));
});
