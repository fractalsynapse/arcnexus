import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ComponentTestFixture } from './component-test-fixture.js';

/**
 * Declares the activities a fixture leaf selects.
 *
 * Each activity states its position, model, bound operations and its own direction, because a
 * component carries no role of its own and the platform's director must declare research for itself.
 */
const leafActivities = (id: string): Record<string, unknown> => ({
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

/** Supplies minimal components while preserving the established Node test conventions. */
export class MinimalTestFixture extends ComponentTestFixture {
  /** Creates explicit configuration ownership and an inherited test profile with no discovery fields. */
  constructor(t: TestContext, packageRoot = '.') {
    super(t);
    this.environment();
    if (packageRoot !== '.') {
      mkdirSync(join(this.repo, packageRoot));
      renameSync(join(this.repo, 'tests'), join(this.repo, packageRoot, 'tests'));
    }
    this.platformDefinition();
    this.definition('package', 'package', {
      parentId: 'platform',
      root: packageRoot,
      testProfile: 'node',
      classification: [{ path: 'tests/examples', kind: 'documentation' }],
    });
    this.definition('sample', 'library', { parentId: 'package', owns: ['tests'] });
    this.maintenance();
    this.commit();
  }

  /** Declares repository identity explicitly for the two package roots. */
  private environment(): void {
    // The base fixture already established this checkout's origin for the repository its catalog
    // declares; adding it a second time fails in git and masked the behavior every scenario below
    // intends to exercise.
    if (!this.git('remote').trim().split('\n').includes('origin'))
      this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.put('.arc/architecture/environment.yaml', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
  }

  /** Keeps shared configuration owned without giving a container descendant write authority. */
  private maintenance(): void {
    this.definition('maintenance-package', 'package', { parentId: 'platform' });
    this.definition('maintenance', 'foundation', {
      parentId: 'maintenance-package',
      owns: [
        '.arc/architecture/environment.yaml',
        '.arc/architecture/roles',
        '.arc/architecture/execution-profiles',
        '.arc/architecture/test-profiles',
        '.arc/architecture/components/platform.yaml',
        '.arc/architecture/components/package.yaml',
        '.arc/architecture/components/maintenance-package.yaml',
        'build.cjs',
        '.gitignore',
      ],
    });
  }

  /** Declares the platform's authority: it directs and reviews through named positions, not itself. */
  private platformDefinition(): void {
    this.definition('platform', 'platform', {
      activities: {
        research: {
          role: 'engineer',
          profile: 'luna',
          operations: [],
          instructions: ['Resolve what the sample platform actually does before proposing change'],
        },
      },
      executionProfile: 'luna',
      reads: ['.'],
      director: { component: 'sample', profile: 'luna' },
      reviewerProfile: 'luna',
    });
  }

  /** Writes one architectural declaration without legacy location or discovery duplication. */
  private definition(id: string, type: string, fields: object): void {
    this.put(`.arc/architecture/components/${id}.yaml`, {
      schemaVersion: 6,
      id,
      type,
      purpose: 'Own test selection',
      ...(type === 'platform' || type === 'package' ? {} : { activities: leafActivities(id) }),
      ...fields,
    });
  }
}
