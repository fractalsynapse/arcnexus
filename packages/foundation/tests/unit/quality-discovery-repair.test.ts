import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { fixture, selection } from './quality-fixture.js';

function observeReads(context: TestContext, reads: string[]) {
  const read = fs.readFileSync;
  context.mock.method(fs, 'readFileSync', ((
    path: fs.PathOrFileDescriptor,
    ...args: unknown[]
  ) => {
    if (typeof path === 'string' && path.endsWith('.gitignore')) reads.push(path);
    return Reflect.apply(read, fs, [path, ...args]);
  }) as typeof fs.readFileSync);
}

function observeDirectories(context: TestContext, directories: string[]) {
  const readdir = fs.readdirSync;
  context.mock.method(fs, 'readdirSync', ((path: fs.PathLike, ...args: unknown[]) => {
    directories.push(String(path));
    return Reflect.apply(readdir, fs, [path, ...args]);
  }) as typeof fs.readdirSync);
}

function observeGlobs(context: TestContext, globs: string[]) {
  const glob = fs.globSync;
  context.mock.method(fs, 'globSync', ((pattern: string | string[], ...args: unknown[]) => {
    globs.push(String(pattern));
    return Reflect.apply(glob, fs, [pattern, ...args]);
  }) as typeof fs.globSync);
}

function observeDiscovery(context: TestContext) {
  const reads: string[] = [];
  const directories: string[] = [];
  const globs: string[] = [];
  observeReads(context, reads);
  observeDirectories(context, directories);
  observeGlobs(context, globs);
  syncBuiltinESMExports();
  return { reads, directories, globs };
}

for (const operation of ['format:check', 'lint'] as const) {
  for (const path of ['package.json', 'package-lock.json']) {
    test(`${operation} owner identity tracks ${path}`, async () => {
      const tree = fixture();
      try {
        if (path === 'package-lock.json') tree.write(path, '{"lockfileVersion":3}\n');
        const before = await selection(tree, operation);
        tree.write(path, '{"changed":true}\n');
        const after = await selection(tree, operation);
        assert.deepEqual(after.files, before.files);
        assert.notEqual(after.identity, before.identity);
      } finally {
        tree.close();
      }
    });
  }

  test(`${operation} prunes excluded directories and reads reachable ignores once`, async (context) => {
    const tree = fixture();
    try {
      tree.write('.gitignore', 'packages/alpha/generated/\n');
      tree.write('packages/alpha/.gitignore', '# reachable\n');
      tree.write('packages/alpha/generated/.gitignore', '# excluded\n');
      tree.write('packages/alpha/generated/hidden.ts', 'export const hidden = 1;\n');
      const { reads, directories, globs } = observeDiscovery(context);
      try {
        const result = await selection(tree, operation);
        assert(result.files.includes('packages/alpha/probe.ts'));
        assert(!result.files.includes('packages/alpha/generated/hidden.ts'));
        assert(!globs.some((pattern) => pattern.startsWith('**/')));
        assert(!directories.some((path) => path.includes('packages/alpha/generated')));
        assert.equal(reads.filter((path) => path.endsWith('/.gitignore')).length, 2);
        assert.equal(reads.filter((path) => path.endsWith('/packages/alpha/.gitignore')).length, 1);
        assert(!reads.some((path) => path.includes('packages/alpha/generated/')));
      } finally {
        context.mock.restoreAll();
        syncBuiltinESMExports();
      }
    } finally {
      tree.close();
    }
  });
}
