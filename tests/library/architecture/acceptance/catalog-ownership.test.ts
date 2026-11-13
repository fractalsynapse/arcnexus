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
    const components = readdirSync('architecture/components', { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:json|yaml|yml)$/.test(entry.name))
      .map((entry) => parse(readFileSync('architecture/components/' + entry.name, 'utf8')))
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
   * `.arc/plans/` and `.arc/learning/` hold agent-authored files and may sit empty in a clean checkout, so the
   * existing per-file ownership pass cannot see them: the gap only appears when a cycle first writes there and is
   * refused. This reads the documented spaces straight from the table and asserts authored `owns` coverage, so
   * adding or renaming a space without a steward fails the suite instead of failing a live run.
   */
  documentedArcSpacesHaveExactlyOneSteward(): void {
    const spaces = readFileSync('.arc/README.md', 'utf8')
      .split('\n')
      .map((line) => line.match(/^\|\s*`(\.arc[^`]+)`/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match) => match[1]!.replace(/\/+$/, ''));
    assert.ok(
      spaces.length >= 3,
      'expected the documented .arc spaces, found: ' + spaces.join(', '),
    );
    for (const space of spaces) {
      const stewards = this.components()
        .filter((c: any) =>
          (c.owns ?? []).some((path: string) => space === path || space.startsWith(path + '/')),
        )
        .map((c: any) => c.id);
      assert.equal(
        stewards.length,
        1,
        `${space} must have exactly one steward, found ${stewards.join(', ') || 'none'}`,
      );
    }
  }

  /**
   * Requires every tracked file in this repository to resolve to exactly one component owner.
   *
   * The runtime validator already refuses an unowned or doubly owned path, but it reads the
   * committed tree, so a file can enter the repository and only be noticed later by whoever runs
   * `validate`. This walks `git ls-files` against the resolved owners, so coverage of source, tests,
   * docs, scripts, fixtures and root files is a test result rather than an operator discovery.
   */
  everyTrackedFileHasExactlyOneOwner(): void {
    const owners = this.catalog().owners as Record<string, any>;
    const scopeOf = (owner: any): string[] => [
      ...new Set([
        ...(owner.ownedPaths ?? []),
        ...(owner.writeScope ?? []),
        ...(owner.definition?.path ? [owner.definition.path] : []),
      ]),
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
    return readdirSync('architecture/components', { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:json|yaml|yml)$/.test(entry.name))
      .map((entry) => parse(readFileSync('architecture/components/' + entry.name, 'utf8')));
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
