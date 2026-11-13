import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkflowFixture } from './workflow-fixture.js';

/**
 * Declares the activities a general-catalog component selects.
 *
 * A component states no position of its own: each activity names its role, model, bound operations
 * and its own direction, and the platform's director must declare research for itself.
 */
const activitiesFor = (id: string): Record<string, unknown> => ({
  research: {
    role: 'engineer',
    profile: 'luna',
    operations: [],
    instructions: [`Establish what ${id} must keep true before changing it`],
  },
  testing: {
    role: 'engineer',
    profile: 'luna',
    operations: [],
    instructions: [`Express acceptance for ${id} as checks over its declared contract`],
  },
  review: {
    role: 'engineer',
    profile: 'luna',
    operations: [],
    instructions: [`Judge ${id} work against accepted behaviour, not intent`],
  },
});

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
          activities: activitiesFor(id),
        }),
      );
    }
    this.package();
    this.profiles();
    this.operations();
    this.composition();
    // The declared primary repository needs a matching origin, but a fixture layered on another may
    // already have established it: adding twice fails in git, and 51 gateway suites were reporting
    // that clash instead of the behavior under test.
    if (!f.git('remote').trim().split('\n').includes('origin'))
      f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
  }

  /** Assigns shared scaffold maintenance to one executable owner, excluding its implicit definition. */
  /**
   * The scope this add-on owns once it is stacked onto a base catalog.
   *
   * One component maintains shared configuration in a composed catalog, the way this repository uses
   * `architecture-maintenance` for its root and architecture files, and every tracked file must
   * resolve to exactly one owner. The base fixture's maintenance leaf already claims `.gitignore`, the
   * operation scripts, the environment document, roles, profiles and the container definitions - so
   * this list carries only the four paths nothing else claims, which I read off the documents on disk
   * rather than guessing. A second claim on any of them makes the catalog refuse to load, and because
   * `Portfolio.register` loads a catalog, registration itself fails and every suite that composes this
   * fixture dies before reaching its subject.
   */
  private maintenance(): string[] {
    return ['source.txt', 'docs', 'tests', 'new.txt'];
  }

  /** Captures inherited policies once and keeps the package a context container. */
  private package(): void {
    const definitions = {
      platform: {
        schemaVersion: 6,
        id: 'platform',
        type: 'platform',
        purpose: 'Controlled host acceptance',
        activities: activitiesFor('platform'),
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
