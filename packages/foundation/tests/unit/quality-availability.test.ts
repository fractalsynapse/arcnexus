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
  assert.equal(
    typeof entry.qualityOperationAvailable,
    'function',
    'Foundation capability is missing',
  );
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

const approvedFormat = { ...format, args: ['run', 'format:check', '--', { context: 'owner' }] };
const approvedLint = { ...lint, args: ['run', 'lint', '--', { context: 'owner' }] };

test('public capability accepts the captured owner-format operation binding', () => {
  assert.equal(capability()(approvedFormat), true);
});

test('public capability accepts the captured owner-lint binding with operation ID quality', () => {
  const binding = { ...approvedLint, id: 'quality', category: 'check' };
  assert.equal(capability()(binding), true);
});

test('public capability rejects mismatched captured applicability and unknown bindings', () => {
  assert.equal(capability()({ ...approvedFormat, applicability: 'owner-lint-files' }), false);
  assert.equal(capability()({ ...approvedLint, args: ['run', 'unknown', '--', { context: 'owner' }] }), false);
});

test('public capability rejects unavailable command and runner for captured bindings', () => {
  assert.equal(capability()({ ...approvedFormat, command: '/missing-quality-command' }), false);
  const tree = new QualityFixture();
  const previous = process.cwd();
  try {
    rmSync(join(tree.root, 'packages/foundation/scripts/owner-quality.ts'));
    process.chdir(tree.root);
    assert.equal(capability()(approvedLint), false);
  } finally {
    process.chdir(previous);
    tree.close();
  }
});

test('captured binding inspection does not execute its quality command or mutate inputs', () => {
  const tree = new QualityFixture();
  const previous = process.cwd();
  try {
    const binding = structuredClone(approvedLint);
    const before = readFileSync(join(tree.root, 'package.json'));
    process.chdir(tree.root);
    capability()(binding);
    assert.deepEqual(binding, approvedLint);
    assert.deepEqual(readFileSync('package.json'), before);
  } finally {
    process.chdir(previous);
    tree.close();
  }
});

test('public capability recognizes the available owner-scoped format binding', () => {
  assert.equal(capability()(format), true);
});

test('public capability recognizes the available owner-scoped lint binding', () => {
  assert.equal(capability()(lint), true);
});

test('public capability rejects a valid declaration with an unavailable command', () => {
  assert.equal(
    capability()({ ...format, command: '/arcnexus-unavailable-quality-implementation' }),
    false,
  );
});

test('public capability rejects an operation bound to the other quality command', () => {
  assert.equal(capability()({ ...format, args: lint.args }), false);
});

test('capability rejects a script invoking the wrong quality operation', () => {
  const tree = new QualityFixture();
  const previous = process.cwd();
  try {
    const manifest = JSON.parse(readFileSync(join(tree.root, 'package.json'), 'utf8'));
    manifest.scripts.lint = 'jiti packages/foundation/scripts/owner-quality.ts format:check';
    tree.write('package.json', JSON.stringify(manifest));
    process.chdir(tree.root);
    assert.equal(capability()(lint), false);
  } finally {
    process.chdir(previous);
    tree.close();
  }
});

test('capability rejects a binding when its quality runner is missing', () => {
  const tree = new QualityFixture();
  const previous = process.cwd();
  try {
    rmSync(join(tree.root, 'packages/foundation/scripts/owner-quality.ts'));
    process.chdir(tree.root);
    assert.equal(capability()(lint), false);
  } finally {
    process.chdir(previous);
    tree.close();
  }
});

test('capability inspection leaves its binding and maintained inputs unchanged', () => {
  const binding = structuredClone(format);
  const before = readFileSync('package.json');
  capability()(binding);
  assert.deepEqual(binding, format);
  assert.deepEqual(readFileSync('package.json'), before);
});
