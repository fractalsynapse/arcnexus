import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

/** Exercises catalog ownership behavior through observable scenarios. */
class CatalogOwnershipTests {
  /** Verifies that built inspect assigns every real source module to one executable owner. */
  builtInspectAssignsEveryRealSourceModuleToOneExecutableOwner() {
    const components = readdirSync('architecture/components', { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:json|yaml|yml)$/.test(entry.name))
      .map((entry) => parse(readFileSync('architecture/components/' + entry.name, 'utf8')))
      .filter((c: any) => !['platform', 'package'].includes(c.type));
    const owners = components.map((component: any) => this.inspectOwner(component.id));
    const files = readdirSync('src', { recursive: true }).filter((p: any) => p.endsWith('.ts'));
    for (const name of files) {
      const path = 'src/' + name;
      assert.equal(
        owners.filter((c: any) =>
          c.allowedWritePaths.some((p: any) => p === path || path.startsWith(p + '/')),
        ).length,
        1,
        `${path} must have one executable owner`,
      );
    }
  }

  /** Resolves effective owner authority through the built inspect command. */
  private inspectOwner(id: string): any {
    const r = spawnSync(
      process.execPath,
      [
        resolve('dist/cli.js'),
        'inspect',
        id,
        'Inspect ownership',
        '--project',
        process.cwd(),
        '--json',
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    assert.equal(r.status, 0, String(r.error ?? r.stderr));
    return JSON.parse(r.stdout).context.at(-1);
  }
}

const suite = new CatalogOwnershipTests();

test('built inspect assigns every real source module to one executable owner', () =>
  suite.builtInspectAssignsEveryRealSourceModuleToOneExecutableOwner());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
