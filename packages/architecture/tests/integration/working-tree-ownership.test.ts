import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Architecture, openProject } from '../../src/index.js';
import { OwnershipProject, collisionPaths, uncoveredPaths } from './ownership-project.js';

export const suite = { owner: 'architecture', level: 'integration', tags: ['regression'] } as const;

interface OwnershipAudit {
  source: { kind: 'working-tree'; root: string; remote: string; revision: string };
  paths: readonly string[];
  findings: readonly (
    | { kind: 'unowned'; path: string }
    | { kind: 'collision'; path: string; owners: readonly string[] }
  )[];
}

/** Reach the new public service at runtime so missing behavior is a red, not a compiler error. */
function audit(directory: string): OwnershipAudit {
  const architecture = new Architecture();
  assert.ok(
    'checkOwnership' in architecture,
    'Architecture.checkOwnership must expose the read-only working-tree ownership audit',
  );
  assert.equal(typeof architecture.checkOwnership, 'function');
  const check = architecture.checkOwnership as (directory: string) => OwnershipAudit;
  return check.call(architecture, directory);
}

/** Retain every fixture byte and modification timestamp, including Git metadata and the index. */
function snapshot(root: string) {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .sort()
    .map((path) => {
      const absolute = join(root, path);
      const stat = lstatSync(absolute);
      return {
        path,
        mode: stat.mode,
        modified: stat.mtimeMs,
        content: stat.isFile() ? readFileSync(absolute).toString('base64') : null,
      };
    });
}

const literalPaths = [
  '-leading.ts',
  'unowned/ white space .ts',
  'unowned/tab\tname.ts',
  'unowned/line\nbreak.ts',
  'unowned/[literal]*?.ts',
];

/** Modify real candidate declarations independently of the committed authority. */
function prepareCandidate(project: OwnershipProject) {
  const zeta = project.capture.components.zeta!;
  project.yaml('.arc/architecture/components/zeta.yaml', {
    ...zeta,
    owns: zeta.owns.filter((root) => root !== 'src/zeta').concat('.gitignore'),
  });
  project.yaml('.arc/architecture/components/gamma.yaml', {
    id: 'gamma',
    purpose: 'Own newly introduced candidate resources.',
    owns: ['fresh'],
    activities: {},
  });
  project.write('.gitignore', 'ignored/\n');
  project.write('ignored/not-in-inventory.ts', 'ignored candidate\n');
  project.write('fresh/staged.ts', 'staged candidate\n');
  project.git('add', '--', 'fresh/staged.ts');
  for (const path of [...literalPaths, 'staged/uncovered.ts']) project.write(path, 'candidate\n');
  project.git('add', '--', 'staged/uncovered.ts');
  rmSync(join(project.root, 'src/alpha/unique.ts'));
}

/** Specify the complete inventory independently from the audit result. */
function candidateInventory(project: OwnershipProject) {
  return [
    ...project.capture.source.paths,
    '.arc/architecture/components/gamma.yaml',
    '.gitignore',
    'fresh/staged.ts',
    ...literalPaths,
    'staged/uncovered.ts',
  ].sort();
}

test('working-tree audit includes candidate declarations, index additions and literal untracked paths from nested callers', (t) => {
  const project = new OwnershipProject(t);
  prepareCandidate(project);
  const before = snapshot(project.root);
  const observed = audit(project.root);
  assert.deepEqual(observed.source, {
    kind: 'working-tree',
    root: project.root,
    remote: project.capture.source.remote,
    revision: project.capture.source.revision,
  });
  assert.deepEqual(observed.paths, candidateInventory(project));
  assert.deepEqual(
    observed.findings,
    [...literalPaths, 'staged/uncovered.ts', 'src/zeta/unique.ts']
      .sort()
      .map((path) => ({ kind: 'unowned', path })),
  );
  assert.deepEqual(audit(join(project.root, 'src/beta')), observed);
  assert.deepEqual(snapshot(project.root), before);
});

test('working-tree audit returns every mixed finding and every conflicting owner in deterministic order', (t) => {
  const project = new OwnershipProject(t, 'mixed');
  const expected = [
    ...collisionPaths.map((path) => ({
      kind: 'collision',
      path,
      owners: ['alpha', 'beta', 'zeta'],
    })),
    ...uncoveredPaths.map((path) => ({ kind: 'unowned', path })),
  ];
  const before = JSON.stringify(project.capture);
  const observed = audit(project.root);
  assert.deepEqual(observed.findings, expected);
  assert.deepEqual(observed.paths, [...project.capture.source.paths].sort());
  assert.deepEqual(audit(project.root), observed);
  assert.equal(JSON.stringify(project.capture), before);
});

test('working-tree audit is read-only and a uniquely owned inventory has no findings', (t) => {
  const project = new OwnershipProject(t);
  const before = snapshot(project.root);
  const observed = audit(project.root);
  assert.deepEqual(observed.findings, []);
  assert.deepEqual(observed.paths, [...project.capture.source.paths].sort());
  assert.deepEqual(snapshot(project.root), before);
});

test('candidate changes leave committed openProject reads and existing immutable captures unchanged', (t) => {
  const project = new OwnershipProject(t);
  const source = openProject(project.root);
  const path = '.arc/architecture/components/zeta.yaml';
  const committed = source.read(path);
  const captured = JSON.stringify(project.capture);
  prepareCandidate(project);
  const before = snapshot(project.root);
  assert.equal(source.read(path), committed);
  assert.equal(openProject(join(project.root, 'src/beta')).read(path), committed);
  assert.deepEqual(new Architecture().capture(project.root).components, project.capture.components);
  assert.equal(JSON.stringify(project.capture), captured);
  assert.ok(Object.isFrozen(project.capture.components.zeta!.owns));
  assert.deepEqual(snapshot(project.root), before);
});

test('malformed working-tree catalogs and unreadable Git projects are explicit source errors', (t) => {
  const project = new OwnershipProject(t);
  project.write('.arc/architecture/components/zeta.yaml', 'owns: [unterminated\n');
  const before = snapshot(project.root);
  assert.throws(() => audit(project.root), /(?:catalog|yaml|parse|flow)/i);
  assert.deepEqual(snapshot(project.root), before);
  assert.throws(() => audit(join(project.root, 'missing-directory')), /(?:Git|project|directory)/);
});
