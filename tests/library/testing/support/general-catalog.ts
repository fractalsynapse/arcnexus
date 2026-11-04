import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkflowFixture } from './workflow-fixture.js';

/** Builds reusable three-owner authority without provisioning or invoking a native harness. */
export class GeneralCatalog {
  /** Retains the isolated fixture whose committed declarations this builder owns. */
  constructor(private readonly fixture: WorkflowFixture) {}

  /** Replaces obsolete overlapping fixture authority with three disjoint minimal owners. */
  apply(): void {
    const f = this.fixture;
    for (const id of ['sample', 'dependency'])
      rmSync(join(f.repo, `architecture/components/${id}.json`));
    for (const id of ['a', 'b', 'c']) {
      const owns = id === 'a' ? this.maintenance() : [id];
      writeFileSync(
        join(f.repo, `architecture/components/${id}.json`),
        JSON.stringify({
          schemaVersion: 6,
          id,
          type: 'library',
          parentId: 'package',
          purpose: `Own ${id} responsibilities`,
          owns,
        }),
      );
    }
    this.package();
    this.profiles();
    this.operations();
    this.composition();
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
  }

  /** Assigns shared scaffold maintenance to one executable owner, excluding its implicit definition. */
  private maintenance(): string[] {
    return [
      'source.txt',
      'docs',
      'tests',
      'new.txt',
      '.gitignore',
      'verify.cjs',
      'architecture/environment.yaml',
      'architecture/roles',
      'architecture/execution-profiles',
      'architecture/operations',
      'architecture/components/platform.json',
      'architecture/components/package.json',
    ];
  }

  /** Captures inherited policies once and keeps the package a context container. */
  private package(): void {
    const definitions = {
      platform: {
        schemaVersion: 6,
        id: 'platform',
        type: 'platform',
        purpose: 'Controlled host acceptance',
        role: 'engineer',
        executionProfile: 'luna',
        reads: ['.'],
        constraints: ['No commits'],
        operations: { verify: ['verify'] },
        director: { component: 'a', profile: 'luna' },
        reviewerProfile: 'luna',
        defaultPackage: 'package',
      },
      package: {
        schemaVersion: 6,
        id: 'package',
        type: 'package',
        parentId: 'platform',
        purpose: 'Supply three independent test owners',
      },
    };
    for (const [id, definition] of Object.entries(definitions))
      writeFileSync(
        join(this.fixture.repo, `architecture/components/${id}.json`),
        JSON.stringify(definition),
      );
  }

  /** Selects a no-budget profile shared by scripted engineering and independent review. */
  private profiles(): void {
    writeFileSync(
      join(this.fixture.repo, 'architecture/execution-profiles/luna.yaml'),
      JSON.stringify({
        schemaVersion: 3,
        id: 'luna',
        model: 'gpt-6-luna',
        reasoning: 'medium',
        webSearch: 'disabled',
        operationCategories: ['cli-check'],
      }),
    );
  }

  /** Declares one finite host check and composition without inline executable recipes. */
  private operations(): void {
    const f = this.fixture;
    mkdirSync(join(f.repo, 'architecture/operations'), { recursive: true });
    writeFileSync(
      join(f.repo, 'architecture/operations/verify.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        id: 'verify',
        purpose: 'Observe the captured fixture contract',
        repository: 'sample',
        cwd: '.',
        category: 'cli-check',
        kind: 'command',
        command: 'node',
        args: ['verify.cjs'],
        activities: [],
        generatedDirectories: [],
        artifacts: [],
        prerequisites: [],
      }),
    );
  }

  /** Captures repository composition independently of executable operation recipes. */
  private composition(): void {
    const f = this.fixture;
    writeFileSync(
      join(f.repo, 'architecture/environment.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        workspace: {
          primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
          dependencies: [],
        },
      }),
    );
  }
}
