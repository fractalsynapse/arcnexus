import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../../library/testing/support/minimal-catalog-fixture.js';

test('architecture validation accepts absent optional guidance and distinguishes its source', (t) => {
  const fixture = new MinimalCatalogFixture(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.guidance.status, 'valid');
  assert.equal(report.guidance.source, 'working-tree');
  assert.deepEqual(report.guidance.skills, []);
  assert.equal(report.status, 'valid');
});

test('architecture validation rejects tracked malformed guidance without executing agents', (t) => {
  const fixture = new MinimalCatalogFixture(t);
  fixture.put('.agents/skills/example/SKILL.md', '# Missing metadata');
  fixture.git('add', '.agents');
  const result = fixture.run();
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'invalid');
  assert.equal(report.guidance.diagnostics[0].code, 'invalid_skill');
  assert.equal(report.validation, 'static');
});

test('argument-free validation discovers the current local repository', (t) => {
  const fixture = new MinimalCatalogFixture(t);
  const result = spawnSync(process.execPath, [resolve('dist/cli.js'), 'validate', '--json'], {
    cwd: fixture.root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'valid');
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
