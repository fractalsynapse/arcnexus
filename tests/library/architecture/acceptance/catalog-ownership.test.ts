import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
