import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { stringify } from 'yaml';
import { Architecture, type Capture } from '../../src/index.js';

type Scenario = 'unique' | 'uncovered' | 'collisions' | 'mixed';

export const uncoveredPaths = ['unowned/first.ts', 'unowned/second.ts'];
export const collisionPaths = ['src/shared/deep/first.ts', 'src/shared/deep/second.ts'];
const activity = {
  role: 'steward',
  profile: 'standard',
  instructions: ['Inspect the captured project through its declared read boundary.'],
  operations: ['read-file'],
  standards: ['guide'],
};

/** Build real committed sources so validation receives complete immutable captures. */
export class OwnershipProject {
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
  constructor(t: TestContext, scenario: Scenario = 'unique') {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q'], this.options);
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'https://example.com/ownership.git'],
      this.options,
    );
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
    this.yaml('.arc/contracts.yaml', {
      contracts: [
        {
          id: 'fixture/project',
          owner: 'zeta',
          file: 'contracts/project.md',
          stage: 'locked',
          digest: createHash('sha256').update(contract).digest('hex'),
          acceptedBy: 'fixture architect',
          acceptedAt: '2026-01-01',
        },
      ],
    });
    this.writeMappings();
  }

  /** Author all references used by the public request builder after ownership succeeds. */
  private writeMappings() {
    this.yaml('.arc/architecture/roles/steward.yaml', {
      id: 'steward',
      purpose: 'Inspect the project.',
      responsibilities: [],
      instructions: [],
    });
    this.yaml('.arc/architecture/execution-profiles/standard.yaml', {
      id: 'standard',
      model: 'fixture-model',
      reasoning: 'high',
      webSearch: 'disabled',
      operationCategories: ['project-tool'],
    });
    this.yaml('.arc/architecture/operations/read-file.yaml', {
      id: 'read-file',
      category: 'project-tool',
      tool: 'read',
    });
    this.yaml('.arc/architecture/standards/guide.yaml', {
      id: 'guide',
      document: 'contracts/guide.md',
    });
  }

  /** Include an owner without Testing so an eligible roster cannot replace the full catalog. */
  private writeComponents(colliding: boolean) {
    const components = {
      zeta: {
        owns: ['.arc', 'contracts', 'plan.md', 'src/zeta'],
        activities: { testing: activity },
      },
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
        id,
        purpose: `Maintain ${id}'s resources.`,
        ...definition,
      });
  }

  /** Run local fixture Git operations without inheriting user configuration. */
  git(...args: string[]): string {
    return execFileSync('git', args, { ...this.options, encoding: 'utf8' });
  }

  /** Serialize authored mappings without casts or missing production fields. */
  yaml(path: string, value: unknown) {
    this.write(path, stringify(value));
  }

  /** Materialize fixture sources before committing their immutable public capture. */
  write(path: string, content: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }
}
