import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QualityFixture } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  for (const owner of ['alpha', undefined] as const) {
    test(`${operation} excludes nested negations beneath an ignored parent for ${owner ?? 'repository'}`, () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.gitignore', `packages/alpha/generated/${'\n'}`);
        tree.write('packages/alpha/generated/.gitignore', `!child/${'\n'}`);
        tree.write('packages/alpha/generated/child/.gitignore', `!probe.ts/${'\n'}`);
        tree.write('packages/alpha/generated/child/probe.ts', `const unused=1${'\n'}`);

        const result = tree.run(operation, owner);
        assert.equal(result.status, 0, result.output);
        if (owner) assert.match(result.output, /empty|no applicable/i);
      } finally {
        tree.close();
      }
    });
  }
}
