import assert from 'node:assert/strict';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import type { Capture } from '../../../architecture/src/index.js';
import { selectQualityInputs } from '../../../foundation/src/index.js';
import { check } from '../../src/check.js';

for (const [operation, applicability] of [
  ['format:check', 'owner-format-files'],
  ['lint', 'owner-lint-files'],
] as const) {
  test(`host applicability agrees with Foundation ${operation} selection`, async (t) => {
    const root = process.cwd();
    const components = Object.fromEntries(
      globSync('.arc/architecture/components/*.yaml').map((path) => {
        const component = parse(readFileSync(path, 'utf8')) as { id: string; owns: string[] };
        return [component.id, component];
      }),
    );
    const owner = Object.keys(components).find(async () => true)!;
    const selection = await selectQualityInputs(operation, owner);
    const temporary = mkdtempSync(join(tmpdir(), 'arcnexus-quality-parity-'));
    t.after(() => rmSync(temporary, { recursive: true, force: true }));
    const capture = {
      source: { root },
      project: { checks: { acceptance: [] } },
      components,
      operations: {
        quality: {
          id: 'quality', category: 'build', command: '/usr/bin/true',
          args: [], network: false, applicability,
        },
      },
    } as unknown as Capture;
    const result = await check(
      capture, root, temporary, 'quality', owner, join(temporary, 'quality.log'),
      AbortSignal.timeout(30_000),
    );
    assert.equal(result.status === 'not-applicable', selection.files.length === 0);
  });
}
