import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as foundation from '../../src/index.js';
import { QualityFixture } from './quality-fixture.js';

type Binding = {
  tool: string;
  applicability: string;
  command: string;
  args: (string | { context: string })[];
};

type Capability = (binding: Binding) => boolean;

/** Access the proposed public capability without preventing the pre-change build. */
function capability(): Capability {
  const entry = foundation as unknown as Record<string, unknown>;
  assert.equal(typeof entry.qualityOperationAvailable, 'function', 'Foundation capability is missing');
  return entry.qualityOperationAvailable as Capability;
}

const format: Binding = {
  tool: 'check',
  applicability: 'owner-format-files',
  command: 'npm',
  args: ['run', 'format:check', { context: 'owner' }],
};

const lint: Binding = {
  tool: 'check',
  applicability: 'owner-lint-files',
  command: 'npm',
  args: ['run', 'lint', { context: 'owner' }],
};

test('public capability recognizes the available owner-scoped format binding', () => {
  assert.equal(capability()(format), true);
});

test('public capability recognizes the available owner-scoped lint binding', () => {
  assert.equal(capability()(lint), true);
});

test('public capability rejects a valid declaration with an unavailable command', () => {
  assert.equal(capability()({ ...format, command: '/arcnexus-unavailable-quality-implementation' }), false);
});

test('public capability rejects an operation bound to the other quality command', () => {
  assert.equal(capability()({ ...format, args: lint.args }), false);
});

test('capability inspection leaves its binding and maintained inputs unchanged', () => {
  const binding = structuredClone(format);
  const before = readFileSync('package.json');
  capability()(binding);
  assert.deepEqual(binding, format);
  assert.deepEqual(readFileSync('package.json'), before);
});
