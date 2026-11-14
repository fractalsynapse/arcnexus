import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

/** Exercises catalog ownership behavior through observable scenarios. */
class CatalogOwnershipTests {
  /** Verifies that built validation assigns every real source module to one executable owner. */
  builtValidationAssignsEveryRealSourceModuleToOneExecutableOwner() {
    const components = readdirSync('.arc/architecture/components', { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:json|yaml|yml)$/.test(entry.name))
      .map((entry) => parse(readFileSync('.arc/architecture/components/' + entry.name, 'utf8')))
      .filter((c: any) => !['platform', 'package'].includes(c.type));
    const catalog = this.catalog();
    assert.deepEqual(Object.keys(catalog.owners).sort(), components.map((c: any) => c.id).sort());
    const owners = Object.values(catalog.owners);
    const files = readdirSync('src', { recursive: true }).filter((p: any) => p.endsWith('.ts'));
    for (const name of files) {
      const path = 'src/' + name;
      assert.equal(
        owners.filter((c: any) =>
          c.writeScope.some((p: any) => p === path || path.startsWith(p + '/')),
        ).length,
        1,
        `${path} must have one executable owner`,
      );
    }
  }

  /**
   * Requires every `.arc` space the README documents to have exactly one component steward.
   *
   * `.arc/plans/` and `.arc/learning/` hold agent-authored files and may sit empty in a clean checkout,
   * so the per-file ownership pass cannot see them: the gap only appears when a cycle first writes there
   * and is refused. This reads the documented spaces straight from the table and asserts authored `owns`
   * coverage, so adding or renaming a space without a steward fails the suite instead of failing a live
   * run. The model space is handled by `assertModelSpaceStewarded` for its own reasons.
   */
  documentedArcSpacesHaveExactlyOneSteward(): void {
    const spaces = this.documentedSpaces();
    assert.ok(
      spaces.length >= 3,
      'expected the documented .arc spaces, found: ' + spaces.join(', '),
    );
    for (const space of spaces.filter((path) => path !== '.arc/architecture')) {
      const stewards = this.stewards(space);
      assert.equal(
        stewards.length,
        1,
        `${space} must have exactly one steward, found ${stewards.join(', ') || 'none'}`,
      );
    }
    this.assertModelSpaceStewarded();
  }

  /**
   * Requires the model space to be claimed from within rather than held by one steward.
   *
   * Since the model moved into the knowledge root, every component owns its own definition under
   * `.arc/architecture/components/`, `architecture-maintenance` stewards the shared directories, and
   * other owners hold specific files there. Demanding a single steward would be a false claim, and a
   * blanket claim would collide with implicit definition ownership. What must hold is that owners exist
   * inside the space and that no file in it is ownerless or doubly owned, which
   * `everyTrackedFileHasExactlyOneOwner` proves across the whole tracked tree.
   */
  private assertModelSpaceStewarded(): void {
    const space = '.arc/architecture';
    const claims = this.components()
      .flatMap((c: any) => c.owns ?? [])
      .filter(
        (path: string) =>
          path === space || path.startsWith(space + '/') || space.startsWith(path + '/'),
      );
    assert.ok(
      claims.length >= 1,
      `${space} must be claimed by component ownership, in whole or in part`,
    );
  }

  /** Reads the documented `.arc` spaces straight from the README table. */
  private documentedSpaces(): string[] {
    return readFileSync('.arc/README.md', 'utf8')
      .split('\n')
      .map((line) => line.match(/^\|\s*`(\.arc[^`]+)`/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match) => match[1]!.replace(/\/+$/, ''));
  }

  /** Lists the components whose ownership covers a whole space. */
  private stewards(space: string): string[] {
    return this.components()
      .filter((c: any) =>
        (c.owns ?? []).some((path: string) => space === path || space.startsWith(path + '/')),
      )
      .map((c: any) => c.id);
  }

  /**
   * Requires every tracked file in this repository to resolve to exactly one component owner.
   *
   * The runtime validator already refuses an unowned or doubly owned path, but it reads the
   * committed tree, so a file can enter the repository and only be noticed later by whoever runs
   * `validate`. This walks `git ls-files` against the resolved owners, so coverage of source, tests,
   * docs, scripts, fixtures and root files is a test result rather than an operator discovery.
   *
   * Coverage is evaluated against committed authority, because that is what the validator
   * reads: a file and the ownership declaration for it must land in the same commit, which is
   * the behaviour worth enforcing rather than working around.
   */
  everyTrackedFileHasExactlyOneOwner(): void {
    const owners = this.catalog().owners as Record<string, any>;
    // Captured paths only. A component's own definition is deliberately outside its ownership so the
    // steward of `.arc/architecture` is the single writer of every profile; adding the definition path
    // back here would report every profile as double-owned.
    const scopeOf = (owner: any): string[] => [
      ...new Set([...(owner.ownedPaths ?? []), ...(owner.writeScope ?? [])]),
    ];
    const covers = (file: string, root: string) =>
      root === '.' || file === root || file.startsWith(root + '/');
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(tracked.length > 100, 'expected the real repository file list');
    const orphans: string[] = [];
    const contested: string[] = [];
    for (const file of tracked) {
      const holders = Object.entries(owners)
        .filter(([, owner]) => scopeOf(owner).some((path: string) => covers(file, path)))
        .map(([id]) => id);
      if (!holders.length) orphans.push(file);
      else if (holders.length > 1) contested.push(`${file}: ${holders.join(', ')}`);
    }
    assert.deepEqual(orphans, [], `unowned tracked files: ${orphans.slice(0, 12).join(', ')}`);
    assert.deepEqual(contested, [], `doubly owned files: ${contested.slice(0, 8).join(' | ')}`);
  }

  /** Reads the authored component declarations, including their ownership lists. */
  private components(): any[] {
    return readdirSync('.arc/architecture/components', { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:json|yaml|yml)$/.test(entry.name))
      .map((entry) => parse(readFileSync('.arc/architecture/components/' + entry.name, 'utf8')));
  }

  /** Resolves all effective owners through one complete production validation instead of rebuilding per owner. */
  private catalog(): any {
    const r = spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'validate', '--project', process.cwd(), '--json'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    assert.equal(r.status, 0, String(r.error ?? r.stderr));
    return JSON.parse(r.stdout);
  }
}

const suite = new CatalogOwnershipTests();

test('built validation assigns every real source module to one executable owner', () =>
  suite.builtValidationAssignsEveryRealSourceModuleToOneExecutableOwner());

test('every documented .arc space has exactly one component steward', () =>
  suite.documentedArcSpacesHaveExactlyOneSteward());

test('every tracked file belongs to exactly one component owner', () =>
  suite.everyTrackedFileHasExactlyOneOwner());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
