import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { stringify } from 'yaml';
import { team } from '../../../team/src/index.js';
import { Architecture, validateCapture, type Capture } from '../../src/index.js';

export const suite = { owner: 'architecture', level: 'integration', tags: ['regression'] } as const;

type Scenario = 'unique' | 'uncovered' | 'collisions' | 'mixed';

const uncoveredPaths = ['unowned/first.ts', 'unowned/second.ts'];
const collisionPaths = ['src/shared/deep/first.ts', 'src/shared/deep/second.ts'];
const activity = {
  role: 'steward',
  profile: 'standard',
  instructions: ['Inspect the captured project through its declared read boundary.'],
  operations: ['read-file'],
  standards: ['guide'],
};

/** Build real committed sources so validation receives complete immutable captures. */
class OwnershipProject {
  readonly root = mkdtempSync(join(tmpdir(), 'architecture-ownership-'));
  readonly capture: Capture;
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
    stdio: 'pipe' as const,
  };

  /** Commit an isolated catalog and capture it through Architecture's public service. */
  constructor(t: TestContext, scenario: Scenario) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q'], this.options);
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.com/ownership.git'], this.options);
    this.writeAuthority();
    this.writeComponents(scenario === 'collisions' || scenario === 'mixed');
    for (const path of ['src/alpha/unique.ts', 'src/beta/unique.ts', 'src/zeta/unique.ts'])
      this.write(path, 'export {};\n');
    if (scenario === 'uncovered' || scenario === 'mixed')
      for (const path of uncoveredPaths) this.write(path, 'export {};\n');
    if (scenario === 'collisions' || scenario === 'mixed')
      for (const path of collisionPaths) this.write(path, 'export {};\n');
    execFileSync('git', ['add', '.'], this.options);
    execFileSync('git', ['commit', '-qm', 'Ownership fixture'], this.options);
    this.capture = new Architecture().capture(this.root);
  }

  /** Supply accepted contract bytes, explicit actor bindings and a real plan source. */
  private writeAuthority() {
    const contract = '# Fixture contract\n\nEvery maintained path has one owner.\n';
    this.write('contracts/project.md', contract);
    this.write('contracts/guide.md', '# Fixture guide\n\nPreserve captured ownership.\n');
    this.write('plan.md', '# Plan\n\nUse the captured owners.\n');
    this.yaml('.arc/architecture/project.yaml', {
      id: 'ownership',
      remote: 'https://example.com/ownership.git',
      contractRegistry: '.arc/contracts.yaml',
      planTemplate: 'plan.md',
      director: { component: 'zeta', activity: 'testing' },
      verifier: { component: 'alpha', activity: 'testing' },
    });
    this.yaml('.arc/contracts.yaml', { contracts: [{
      id: 'fixture/project', owner: 'zeta', file: 'contracts/project.md', stage: 'locked',
      digest: createHash('sha256').update(contract).digest('hex'),
      acceptedBy: 'fixture architect', acceptedAt: '2026-01-01',
    }] });
    this.writeMappings();
  }

  /** Author all references used by the public request builder after ownership succeeds. */
  private writeMappings() {
    this.yaml('.arc/architecture/roles/steward.yaml', {
      id: 'steward', purpose: 'Inspect the project.', responsibilities: [], instructions: [],
    });
    this.yaml('.arc/architecture/execution-profiles/standard.yaml', {
      id: 'standard', model: 'fixture-model', reasoning: 'high', webSearch: 'disabled',
      operationCategories: ['project-tool'],
    });
    this.yaml('.arc/architecture/operations/read-file.yaml', {
      id: 'read-file', category: 'project-tool', tool: 'read',
    });
    this.yaml('.arc/architecture/standards/guide.yaml', {
      id: 'guide', document: 'contracts/guide.md',
    });
  }

  /** Include an owner without Testing so an eligible roster cannot replace the full catalog. */
  private writeComponents(colliding: boolean) {
    const components = {
      zeta: { owns: ['.arc', 'contracts', 'plan.md', 'src/zeta'], activities: { testing: activity } },
      beta: { owns: ['src/beta'], activities: { maintenance: activity } },
      alpha: { owns: ['src/alpha'], activities: { testing: activity } },
    };
    if (colliding) {
      components.zeta.owns.push('src/shared');
      components.beta.owns.push('src/shared/deep');
      components.alpha.owns.push('src/shared');
    }
    for (const [id, definition] of Object.entries(components))
      this.yaml(`.arc/architecture/components/${id}.yaml`, {
        id, purpose: `Maintain ${id}'s resources.`, ...definition,
      });
  }

  /** Serialize authored mappings without casts or missing production fields. */
  private yaml(path: string, value: unknown) {
    this.write(path, stringify(value));
  }

  /** Materialize fixture sources before committing their immutable public capture. */
  private write(path: string, content: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }
}

/** Read the caller-visible refusal while rejecting success and non-ownership setup errors. */
function ownershipDiagnostic(capture: Capture): string {
  let diagnostic: string | undefined;
  assert.throws(() => validateCapture(capture), (error: unknown) => {
    assert.ok(error instanceof Error);
    diagnostic = error.message;
    assert.match(diagnostic, /Architecture ownership/);
    return true;
  });
  assert.ok(diagnostic);
  return diagnostic;
}

/** Check independent expected paths and owner identities without prescribing error punctuation. */
function assertComplete(diagnostic: string, paths: readonly string[], owners: readonly string[]) {
  for (const path of paths) assert.ok(diagnostic.includes(path), `Missing path ${path}: ${diagnostic}`);
  for (const id of owners)
    assert.match(diagnostic, new RegExp(`\\b${id}\\b`), `Missing owner ${id}: ${diagnostic}`);
}

test('ARC-3: uniquely owned committed inventory passes the complete public validator', (t) => {
  const { capture } = new OwnershipProject(t, 'unique');
  const before = JSON.stringify(capture);
  assert.doesNotThrow(() => validateCapture(capture));
  assert.doesNotThrow(() => validateCapture(capture));
  assert.equal(JSON.stringify(capture), before);
});

test('ARC-3: ownership refusal names every uncovered maintained resource', (t) => {
  const { capture } = new OwnershipProject(t, 'uncovered');
  assertComplete(ownershipDiagnostic(capture), uncoveredPaths, []);
});

test('ARC-4: each collision names all owners, including the owner without Testing', (t) => {
  const { capture } = new OwnershipProject(t, 'collisions');
  assert.deepEqual(team.list(capture.components, { activity: 'testing' }).map(({ id }) => id), [
    'alpha', 'zeta',
  ]);
  for (const path of collisionPaths) {
    const singleResource = { ...capture, source: { ...capture.source, paths: [path] } };
    assertComplete(ownershipDiagnostic(singleResource), [path], ['alpha', 'beta', 'zeta']);
  }
  assertComplete(ownershipDiagnostic(capture), collisionPaths, ['alpha', 'beta', 'zeta']);
});

test('ARC-3/ARC-4: one refusal retains uncovered resources and every collision together', (t) => {
  const { capture } = new OwnershipProject(t, 'mixed');
  const diagnostic = ownershipDiagnostic(capture);
  assertComplete(diagnostic, [...collisionPaths, ...uncoveredPaths], ['alpha', 'beta', 'zeta']);
  assert.match(diagnostic, /unowned/);
  assert.match(diagnostic, /collision/);
});

test('ARC-7/ARC-16: unchanged capture diagnostics and definitions remain identical across calls', (t) => {
  const { capture } = new OwnershipProject(t, 'mixed');
  const before = JSON.stringify(capture);
  const first = ownershipDiagnostic(capture);
  assert.equal(ownershipDiagnostic(capture), first);
  assert.equal(ownershipDiagnostic(capture), first);
  assert.equal(JSON.stringify(capture), before);
  assert.ok(Object.isFrozen(capture.source.paths));
  for (const component of Object.values(capture.components)) {
    assert.ok(Object.isFrozen(component));
    assert.ok(Object.isFrozen(component.owns));
  }
});
