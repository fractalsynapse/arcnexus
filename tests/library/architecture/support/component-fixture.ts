import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { validateSchema } from '../../../../dist/library/architecture/schema.js';

/**
 * Declares the activities a fixture component selects, each naming its position, model, operations
 * and direction.
 *
 * A component carries no role of its own, so scenarios that need a role for some work state it on
 * that activity. One helper keeps the four fixture documents from tripling the same literal.
 */
export function selectedActivities(profile: string, role = 'engineer'): Record<string, unknown> {
  return {
    research: {
      role,
      profile,
      operations: [],
      instructions: ['Establish what the component guarantees before proposing a change'],
    },
    testing: {
      role,
      profile,
      operations: [],
      instructions: ['Express acceptance as checks over the declared public contract'],
    },
    review: {
      role,
      profile,
      operations: [],
      instructions: ['Judge the candidate against the accepted behaviour, not the intent'],
    },
  };
}

/** Builds a completely owned minimal catalog without legacy component fields. */
export class ComponentFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'component-'));

  /** Captures a clean source revision and removes only this fixture after the scenario. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.git('init', '-b', 'main');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    this.environment();
    this.containers();
    this.owners();
    this.put('package/src/value.ts', 'export const value = 1;');
    this.put('package/docs/value.md', 'Value is one.');
    this.put('package/tests/value.test.ts', '// Test classification without execution.');
    this.commit();
  }

  /** Supplies profile/role authority and a primary repository without inline execution recipes. */
  private environment(): void {
    this.put('.arc/architecture/environment.json', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
    this.put('.arc/architecture/roles/engineer.json', {
      schemaVersion: 4,
      id: 'engineer',
      purpose: 'Engineer bounded changes',
      responsibilities: ['Verify changes'],
    });
    this.put('.arc/architecture/execution-profiles/luna.json', {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['unit-test'],
    });
  }

  /** Declares container defaults and disjoint leaf scope, including catalog maintenance. */
  private containers(): void {
    this.put(
      '.arc/architecture/components/platform.json',
      this.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        constraints: ['Preserve authority'],
        activities: selectedActivities('luna'),
      }),
    );
    this.put(
      '.arc/architecture/components/package.json',
      this.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
      }),
    );
    this.put(
      '.arc/architecture/components/maintenance-package.json',
      this.component('maintenance-package', 'package', {
        parentId: 'platform',
      }),
    );
  }

  /** Assigns configuration maintenance and a leaf with implicit definition ownership. */
  private owners(): void {
    this.put(
      '.arc/architecture/components/maintenance.json',
      this.component('maintenance', 'foundation', {
        parentId: 'maintenance-package',
        owns: [
          '.arc/architecture/environment.json',
          '.arc/architecture/roles',
          '.arc/architecture/execution-profiles',
          '.arc/architecture/components/platform.json',
          '.arc/architecture/components/package.json',
          '.arc/architecture/components/maintenance-package.json',
        ],
      }),
    );
    this.put(
      '.arc/architecture/components/unrelated-filename.json',
      this.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        api: [{ module: 'src/value.ts' }],
      }),
    );
  }

  /** Rejects malformed ordinary setup using the same packaged schema as production loading. */
  component(id: string, type: string, extra: object = {}): any {
    return validateSchema('component', this.uncheckedComponent(id, type, extra));
  }

  /** Builds deliberately malformed declarations only for explicit production rejection scenarios. */
  uncheckedComponent(id: string, type: string, extra: object = {}): any {
    // A leaf declares at least one activity, each stating its position, model, operations and
    // direction; scenarios that need the opposite supply their own declarations through extra.
    return {
      schemaVersion: 6,
      id,
      type,
      purpose: 'Own bounded behavior',
      ...(type === 'library' || type === 'foundation' || type === 'gateway' || type === 'release'
        ? { activities: selectedActivities('luna') }
        : {}),
      ...extra,
    };
  }

  /** Writes source or JSON without interpreting candidate content as current authority. */
  put(path: string, value: unknown): void {
    mkdirSync(join(this.root, path, '..'), { recursive: true });
    writeFileSync(join(this.root, path), typeof value === 'string' ? value : JSON.stringify(value));
  }

  /** Commits the fixture revision used by the assembled CLI. */
  commit(): void {
    this.git('add', '.');
    this.git('commit', '-m', 'fixture');
  }

  /** Runs Git and fails the scenario on repository setup errors. */
  git(...args: string[]): string {
    const result = spawnSync('git', ['-C', this.root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }

  /** Invokes the actual assembled CLI with complete output for catalog assertions. */
  run(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--project', this.root], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
}
