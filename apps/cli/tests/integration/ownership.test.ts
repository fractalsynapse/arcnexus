import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { Architecture, type OwnershipAudit } from '../../../../packages/architecture/src/index.js';
import { projectFixture } from '../fixtures/project.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const candidate = fileURLToPath(new URL('../../../../../', import.meta.url));
const command = ['architecture', 'check-ownership'];
const uncovered = ['unowned/tracked.ts', 'unowned/line\nbreak.ts', 'unowned/tab\tname.ts'];
const shared = 'work/shared/file.ts';

/** Exercise the actual candidate executable against a local project without live credentials. */
class OwnershipCli {
  readonly root = projectFixture();
  readonly architecture = new Architecture();
  private readonly env = {
    PATH: process.env.PATH,
    HOME: this.root,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
  };

  /** Complete unique coverage before committing the independently authored baseline. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    const roots = readdirSync(this.root).filter((path) => !['.git', '.arc'].includes(path));
    this.component('work', roots);
    this.git('add', '.');
    this.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '-qm', 'Complete ownership baseline');
    assert.deepEqual(this.architecture.checkOwnership(this.root).findings, []);
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: candidate, encoding: 'utf8', env: this.env,
    }).trim();
    assert.ok(readFileSync(cli).length, 'candidate CLI must actually be built');
    t.diagnostic(JSON.stringify({ candidateRevision: revision, entryPoint: cli,
      node: process.version, project: this.root, environment: this.env }));
  }

  /** Preserve the full component declaration while changing only fixture ownership. */
  component(id: string, owns: string[]) {
    const path = join(this.root, '.arc/architecture/components', `${id}.yaml`);
    const definition = parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    writeFileSync(path, stringify({ ...definition, owns }));
  }

  /** Use argument arrays for local Git fixture preparation without shell interpretation. */
  git(...args: string[]) {
    return execFileSync('git', args, { cwd: this.root, env: this.env, encoding: 'utf8' });
  }

  /** Add literal tracked or untracked paths without admitting any application task. */
  write(path: string, content = 'fixture\n') {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }

  /** Run Node with the candidate's absolute built entry point, never an installed launcher. */
  run(args = command, directory = this.root) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: directory, env: this.env, encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }

  /** Assert exact output and exit meaning rather than merely recognizing command spelling. */
  json(args = [...command, '--json'], directory = this.root): OwnershipAudit {
    const expected = this.architecture.checkOwnership(directory);
    const result = this.run(args, directory);
    assert.equal(result.status, expected.findings.length ? 1 : 0, result.stderr);
    assert.equal(result.stderr, '');
    const actual: unknown = JSON.parse(result.stdout);
    assert.deepEqual(actual, expected);
    return expected;
  }

  /** Retain all source and Git metadata bytes so task admission and index writes are visible. */
  snapshot() {
    return readdirSync(this.root, { recursive: true, encoding: 'utf8' }).sort().map((path) => {
      const absolute = join(this.root, path);
      const stat = lstatSync(absolute);
      return { path, mode: stat.mode, modified: stat.mtimeMs,
        content: stat.isFile() ? readFileSync(absolute).toString('base64') : null };
    });
  }

  /** Assert complete readable source, inventory and finding identities in service order. */
  human(expected: OwnershipAudit) {
    const result = this.run();
    assert.equal(result.status, expected.findings.length ? 1 : 0, result.stderr);
    assert.equal(result.stderr, '');
    for (const value of Object.values(expected.source)) assert.ok(result.stdout.includes(value));
    let position = -1;
    for (const path of expected.paths) {
      const literal = /[\s]/.test(path) ? JSON.stringify(path) : path;
      position = result.stdout.indexOf(literal, position + 1);
      assert.notEqual(position, -1, `complete ordered inventory: ${literal}`);
    }
    for (const finding of expected.findings) {
      const literal = /[\s]/.test(finding.path) ? JSON.stringify(finding.path) : finding.path;
      assert.ok(result.stdout.includes(literal), literal);
      assert.ok(result.stdout.includes(finding.kind), finding.kind);
      if (finding.kind === 'collision')
        for (const owner of finding.owners) assert.ok(result.stdout.includes(owner), owner);
    }
    if (!expected.findings.length) assert.match(result.stdout, /no ownership findings/i);
  }

  /** Create simultaneous uncovered tracked/untracked paths and uncommitted catalog collisions. */
  mixed() {
    this.write(uncovered[0]!);
    this.write(shared);
    this.git('add', '--', uncovered[0]!, shared);
    this.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '-qm', 'Tracked inventory additions');
    for (const path of uncovered.slice(1)) this.write(path);
    this.component('plan', ['.arc', 'work/shared']);
    this.component('review', ['review', 'work/shared']);
    this.write('.gitignore', 'ignored/\n');
    this.write('ignored/absent.ts');
    // Keep .gitignore uniquely covered while leaving the authored unowned paths uncovered.
    const path = join(this.root, '.arc/architecture/components/work.yaml');
    const work = parse(readFileSync(path, 'utf8')) as { owns: string[] };
    this.component('work', [...work.owns, '.gitignore']);
  }
}

test('GW-34, GW-36: built candidate audits unique coverage in both JSON placements and nested human mode', (t) => {
  const fixture = new OwnershipCli(t);
  const before = fixture.snapshot();
  const expected = fixture.json();
  assert.deepEqual(expected.paths, fixture.git('ls-files', '-z').split('\0').filter(Boolean).sort());
  assert.deepEqual(fixture.json(['--json', ...command]), expected);
  const nested = join(fixture.root, 'work');
  assert.deepEqual(fixture.json([...command, '--json'], nested), expected);
  fixture.human(expected);
  const human = fixture.run(command, nested);
  assert.equal(human.status, 0, human.stderr);
  assert.equal(human.stdout, fixture.run().stdout);
  assert.deepEqual(fixture.snapshot(), before);
});

test('GW-35, GW-36: candidate working-tree collisions coexist with complete tracked and untracked findings', (t) => {
  const fixture = new OwnershipCli(t);
  fixture.mixed();
  const expected = fixture.architecture.checkOwnership(fixture.root);
  assert.deepEqual(expected.findings, [
    ...[...uncovered].sort().map((path) => ({ kind: 'unowned', path })),
    { kind: 'collision', path: shared, owners: ['plan', 'review', 'work'] },
  ]);
  assert.deepEqual(expected.paths, [...fixture.git('ls-files', '-z').split('\0').filter(Boolean),
    '.gitignore', ...uncovered.slice(1)].sort());
  const before = fixture.snapshot();
  fixture.json();
  fixture.json(['--json', ...command], join(fixture.root, 'work/shared'));
  fixture.human(expected);
  assert.deepEqual(fixture.snapshot(), before);
});

test('GW-37: malformed audit arguments refuse locally with empty stdout and no admission', (t) => {
  const fixture = new OwnershipCli(t);
  // An invalid candidate catalog distinguishes parser refusal from premature audit dispatch.
  fixture.write('.arc/architecture/components/work.yaml', 'owns: [unterminated\n');
  const before = fixture.snapshot();
  const malformed = [
    [], ['architecture'], [...command, 'extra'], [...command, '--unknown'],
    ['architecture', '--json', 'check-ownership'], ['--json', ...command, '--json'],
    [...command, '--json', '--json'], [...command, '--json', 'extra'],
  ];
  for (const args of malformed) {
    const result = fixture.run(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:|Command unavailable|Use --json once/);
    assert.doesNotMatch(result.stderr, /unterminated|YAML|flow sequence/i);
  }
  assert.deepEqual(fixture.snapshot(), before);
});

test('GW-38: invalid declarations and missing projects report service failures without a fabricated audit', (t) => {
  const fixture = new OwnershipCli(t);
  fixture.write('.arc/architecture/components/work.yaml', 'owns: [unterminated\n');
  const before = fixture.snapshot();
  for (const args of [command, ['--json', ...command]]) {
    const result = fixture.run(args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /catalog|yaml|parse|flow/i);
  }
  assert.deepEqual(fixture.snapshot(), before);
  rmSync(join(fixture.root, '.git'), { recursive: true });
  const missing = fixture.snapshot();
  const result = fixture.run();
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Git|project|repository/);
  assert.deepEqual(fixture.snapshot(), missing);
});
