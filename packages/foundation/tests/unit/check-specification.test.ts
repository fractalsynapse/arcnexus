import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { stringify } from 'yaml';
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

/** Supplies a tracked catalog and records all maintained bytes around real checker subprocesses. */
class SpecificationFixture {
  readonly cwd: string;

  /** Create independent governance, contract and owner records without borrowing the live catalog. */
  constructor(context: TestContext, collision = false) {
    this.cwd = mkdtempSync(join(tmpdir(), 'arcnexus-specification-ownership-'));
    context.after(() => rmSync(this.cwd, { recursive: true, force: true }));
    execFileSync('git', ['init', '--quiet'], { cwd: this.cwd });
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.com/specification.git'], {
      cwd: this.cwd,
    });
    this.write('.arc/architecture/project.yaml', stringify({
      id: 'fixture', contractRegistry: '.arc/contracts.yaml',
      director: { component: 'project', activity: 'inspect' },
      verifier: { component: 'project', activity: 'inspect' },
    }));
    this.write('.arc/architecture/roles/inspector.yaml', stringify({ id: 'inspector' }));
    this.component('project', ['.arc', 'docs']);
    this.component('zeta', collision ? ['packages/zeta', 'shared'] : ['packages/zeta']);
    this.component('alpha', ['packages/alpha', 'shared']);
    this.write('packages/alpha/src/index.ts', 'export const identity = "alpha";\n');
    this.write('packages/zeta/src/index.ts', 'export const identity = "zeta";\n');
    this.contract();
    this.track();
  }

  /** Declare host activities so ownership validation can proceed through the real catalog checks. */
  private component(id: string, owns: string[]): void {
    this.write(`.arc/architecture/components/${id}.yaml`, stringify({
      id, kind: id === 'project' ? 'project' : 'plugin', purpose: `Fixture ${id} owner.`,
      owns, activities: { inspect: {
        executor: 'host', role: 'inspector', instructions: ['Inspect the fixture.'],
        operations: [], standards: [],
      } },
    }));
  }

  /** Register real contract bytes and a local documentation link for the valid control. */
  private contract(): void {
    const body = '# Fixture contract\n\n| ID | Observation |\n| --- | --- |\n| FIX-1 | Valid ownership. |\n';
    this.write('docs/contract.md', body);
    this.write('docs/guide.md', '# Fixture guide\n\n[Contract](contract.md)\n');
    this.write('.arc/contracts.yaml', stringify({ contracts: [{
      id: 'fixture/contract', file: 'docs/contract.md', owner: 'project', stage: 'proposed',
      digest: createHash('sha256').update(body).digest('hex'), dependsOn: [], scenarios: 1,
    }] }));
  }

  /** Author fixture bytes explicitly; callers track them before invoking the checker. */
  write(path: string, content: string): void {
    mkdirSync(dirname(join(this.cwd, path)), { recursive: true });
    writeFileSync(join(this.cwd, path), content);
  }

  /** Make the maintained inventory visible to the production Git-based entry. */
  track(): void {
    execFileSync('git', ['add', '--all'], { cwd: this.cwd });
  }

  /** Retain exact tracked bytes and Git state, including additions outside the tracked inventory. */
  snapshot() {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: this.cwd, encoding: 'utf8' })
      .split('\0').filter(Boolean);
    return {
      files: paths.map((path) => [path, readFileSync(join(this.cwd, path)).toString('base64')]),
      status: execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
        cwd: this.cwd, encoding: 'utf8',
      }),
    };
  }

  /** Execute the built public entry with inherited CI output disabled and enforce read-only behavior. */
  run() {
    const before = this.snapshot();
    const result = spawnSync(process.execPath, [checker], {
      cwd: this.cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.deepEqual(this.snapshot(), before, 'Specification checks must preserve maintained bytes');
    return result;
  }

  /** Compare full refusal output across unchanged invocations before assessing its ownership content. */
  invalid() {
    const first = this.run();
    const repeated = this.run();
    assert.equal(first.status, 1, first.stderr);
    assert.equal(repeated.status, 1, repeated.stderr);
    assert.equal(repeated.stderr, first.stderr, 'Unchanged ownership diagnostics must be repeatable');
    assert.equal(repeated.stdout, first.stdout);
    return first.stderr;
  }
}

test('uniquely owned tracked specifications pass the real checker without source changes', (t) => {
  const fixture = new SpecificationFixture(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Specification checks passed/);
});

test('specification collisions identify every conflicting component on each affected path', (t) => {
  const fixture = new SpecificationFixture(t, true);
  fixture.write('shared/second.md', '# Second collision\n');
  fixture.write('shared/first.md', '# First collision\n');
  fixture.track();
  const diagnostics = fixture.invalid();
  for (const path of ['shared/first.md', 'shared/second.md']) {
    const line = diagnostics.split('\n').find((entry) => entry.includes(path));
    assert(line, `Missing collision diagnostic for ${path}: ${diagnostics}`);
    assert.match(line, /\balpha\b/, `Missing collision owner alpha for ${path}`);
    assert.match(line, /\bzeta\b/, `Missing collision owner zeta for ${path}`);
    assert(line.indexOf('alpha') < line.indexOf('zeta'), 'Collision IDs must use stable ordering');
  }
});

test('mixed ownership failures report every uncovered and colliding path in stable order', (t) => {
  const fixture = new SpecificationFixture(t, true);
  const paths = ['missing/first.md', 'missing/second.md', 'shared/first.md', 'shared/second.md'];
  for (const path of [...paths].reverse()) fixture.write(path, `# ${path}\n`);
  fixture.track();
  const diagnostics = fixture.invalid();
  for (const path of paths) assert(diagnostics.includes(path), `Missing ownership finding: ${path}`);
  const positions = paths.map((path) => diagnostics.indexOf(path));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(diagnostics, /unowned/i);
  assert.match(diagnostics, /collision/i);
});
