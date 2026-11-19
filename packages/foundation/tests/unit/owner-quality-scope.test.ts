import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixture } from './quality-fixture.js';

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} selects distinct owners and includes new maintained files`, () => {
    const tree = fixture();
    try {
      assert.equal(tree.run(operation, 'alpha').status, 0);
      const beta = tree.run(operation, 'beta');
      assert.notEqual(beta.status, 0, beta.output);
      assert.match(beta.output, /probe\.ts/);
    } finally {
      tree.close();
    }
  });

  test(`${operation} rejects overlapping ownership`, () => {
    const tree = fixture();
    try {
      tree.owner('overlap', 'packages/alpha');
      const result = tree.run(operation, 'alpha');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /owner|ownership/i);
    } finally {
      tree.close();
    }
  });

  test(`${operation} without an owner retains repository-wide coverage`, () => {
    const tree = fixture();
    try {
      const result = tree.run(operation);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /probe\.ts/);
    } finally {
      tree.close();
    }
  });

  test(`${operation} does not mutate maintained source on failure`, () => {
    const tree = fixture();
    try {
      const path = join(tree.root, 'packages/beta/probe.ts');
      const before = readFileSync(path);
      const result = tree.run(operation, 'beta');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /packages\/beta\/probe\.ts/);
      assert.deepEqual(readFileSync(path), before);
    } finally {
      tree.close();
    }
  });
}
