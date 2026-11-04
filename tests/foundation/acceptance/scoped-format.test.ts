import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Exercises the actual shared formatter against isolated maintained files and scoped argv. */
class ScopedFormatScenarios {
  /** Mandatory checking does not expand into owned documentation or architecture outside existing policy. */
  outsideCoverage(t: TestContext): void {
    const f = this.fixture(t);
    const result = f.run('--check', 'docs', 'architecture');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.read('architecture/broken.yaml'), 'broken: [');
    assert.equal(f.read('src/owned/value.ts'), f.unformatted);
  }

  /** Read-only engineering reports only owned formatting, while explicit caller writes preserve other owners. */
  owner(t: TestContext): void {
    const f = this.fixture(t);
    const result = f.run('--check', 'src/owned');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /src\/owned\/value.ts/);
    assert.doesNotMatch(result.stdout, /src\/other/);
    assert.equal(f.read('src/owned/value.ts'), f.unformatted);
    assert.equal(f.run('--write', 'src/owned').status, 0);
    assert.equal(f.run('--check', 'src/owned').status, 0);
    assert.equal(f.read('src/other/value.ts'), f.unformatted);
  }

  /** Assembled checks retain the full policy and find defects outside a previous engineering scope. */
  assembled(t: TestContext): void {
    const f = this.fixture(t);
    assert.equal(f.run('--write', 'src/owned').status, 0);
    const result = f.run('--check');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /src\/other\/value.ts/);
    assert.equal(f.run('--write').status, 0);
    assert.equal(f.run('--check').status, 0);
    assert.equal(f.read('architecture/broken.yaml'), 'broken: [');
  }

  /** Creates actual Git discovery without importing or executing target project source. */
  private fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-scoped-format-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q', directory]);
    for (const path of ['src/owned', 'src/other', 'docs', 'architecture'])
      mkdirSync(join(directory, path), { recursive: true });
    const unformatted = 'export const value={answer:42};';
    writeFileSync(join(directory, 'src/owned/value.ts'), unformatted);
    writeFileSync(join(directory, 'src/other/value.ts'), unformatted);
    writeFileSync(join(directory, 'architecture/broken.yaml'), 'broken: [');
    writeFileSync(join(directory, 'docs/guide.md'), '# Guide\n\nUnformatted     prose');
    writeFileSync(join(directory, '.prettierignore'), '');
    const script = resolve('scripts/foundation/format-check.mjs');
    return {
      unformatted,
      read: (path: string) => readFileSync(join(directory, path), 'utf8'),
      run: (mode: string, ...paths: string[]) =>
        spawnSync(process.execPath, [script, mode, ...paths], { cwd: directory, encoding: 'utf8' }),
    };
  }
}

const scenarios = new ScopedFormatScenarios();

test('owner formatting preserves the existing maintained-code coverage', (t) =>
  scenarios.outsideCoverage(t));

test('owner formatting checks are read-only and explicit writes stay within requested scope', (t) =>
  scenarios.owner(t));

test('assembled formatting still checks all maintained-code owners', (t) => scenarios.assembled(t));

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'scoped-checks'],
});
