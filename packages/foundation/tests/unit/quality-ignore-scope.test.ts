import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QualityFixture, selection } from './quality-fixture.js';

for (const [label, ignorePath, pattern, ignoredPath] of [
  ['nested ignore', 'packages/alpha/.gitignore', 'hidden.ts\n', 'packages/alpha/deep/hidden.ts'],
  ['slashless directory', '.gitignore', 'generated/\n', 'packages/alpha/deep/generated/probe.ts'],
  [
    'double wildcard',
    '.gitignore',
    'packages/**/generated/*.ts\n',
    'packages/alpha/deep/generated/probe.ts',
  ],
] as const) {
  test(`discovery honors ${label} patterns`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      tree.write(ignorePath, pattern);
      tree.write(ignoredPath, 'export const ignored = 1;\n');
      tree.write('packages/alpha/visible.ts', 'export const visible = 1;\n');
      const result = await selection(tree, 'format:check');
      assert(result.files.includes('packages/alpha/visible.ts'));
      assert(!result.files.includes(ignoredPath));
    } finally {
      tree.close();
    }
  });
}

for (const operation of ['format:check', 'lint'] as const) {
  test(`${operation} keeps nested examples when the root directory alone is ignored`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      tree.write('.prettierignore', '');
      tree.write('.gitignore', '/examples/\n');
      const path = 'packages/alpha/examples/probe.ts';
      tree.write(path, 'export const probe = 1;\n');
      assert((await selection(tree, operation)).files.includes(path));
    } finally {
      tree.close();
    }
  });

  test(`${operation} ignores exactly one character for a question wildcard`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      tree.write('.gitignore', 'packages/alpha/probe?.ts\n');
      tree.write('packages/alpha/probe1.ts', 'export const one = 1;\n');
      tree.write('packages/alpha/probe12.ts', 'export const two = 2;\n');
      const result = await selection(tree, operation);
      assert(!result.files.includes('packages/alpha/probe1.ts'));
      assert(result.files.includes('packages/alpha/probe12.ts'));
    } finally {
      tree.close();
    }
  });
}

for (const operation of ['format:check', 'lint'] as const) {
  for (const owner of ['alpha', 'repository']) {
    test(`${operation} ${owner} honors gitignore character classes`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.gitignore', 'packages/alpha/[ab].ts\n');
        for (const name of ['a', 'b', 'c']) {
          tree.write(`packages/alpha/${name}.ts`, `export const ${name} = 1;\n`);
        }
        const result = await selection(tree, operation, owner);
        assert(!result.files.includes('packages/alpha/a.ts'));
        assert(!result.files.includes('packages/alpha/b.ts'));
        assert(result.files.includes('packages/alpha/c.ts'));
      } finally {
        tree.close();
      }
    });

    test(`${operation} ${owner} honors negated gitignore character classes`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.gitignore', 'packages/alpha/[!ab].ts\n');
        for (const name of ['a', 'b', 'c']) {
          tree.write(`packages/alpha/${name}.ts`, `export const ${name} = 1;\n`);
        }
        const result = await selection(tree, operation, owner);
        assert(result.files.includes('packages/alpha/a.ts'));
        assert(result.files.includes('packages/alpha/b.ts'));
        assert(!result.files.includes('packages/alpha/c.ts'));
      } finally {
        tree.close();
      }
    });

    test(`${operation} ${owner} honors nested re-inclusion`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.gitignore', 'packages/alpha/*.ts\n');
        tree.write('packages/alpha/.gitignore', '!probe.ts\n');
        const path = 'packages/alpha/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        assert((await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });

    test(`${operation} ${owner} keeps files matching a directory-only rule`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.gitignore', '*.ts/\n');
        const path = 'packages/alpha/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        assert((await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });
  }
}

for (const operation of ['format:check', 'lint'] as const) {
  for (const owner of ['alpha', 'repository']) {
    test(`${operation} ${owner} requires excluded parent restoration before re-inclusion`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.prettierignore', '');
        const path = 'packages/alpha/generated/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        tree.write('.gitignore', 'packages/alpha/generated/\n');
        tree.write('packages/alpha/generated/.gitignore', '!generated/\n!probe.ts\n');
        assert(!(await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });

    test(`${operation} ${owner} restores a directory from its accessible parent ignore file`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.prettierignore', '');
        tree.write('.gitignore', 'packages/alpha/generated/\n');
        tree.write('packages/alpha/.gitignore', '!generated/\n!generated/probe.ts\n');
        const path = 'packages/alpha/generated/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        assert((await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });

    test(`${operation} ${owner} permits restoration by an applicable ancestor ignore file`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.prettierignore', '');
        const path = 'packages/alpha/generated/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        tree.write(
          '.gitignore',
          'packages/alpha/generated/\n!packages/alpha/generated/\n!packages/alpha/generated/probe.ts\n',
        );
        tree.write('packages/alpha/generated/.gitignore', '!generated/\n!probe.ts\n');
        assert((await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });
  }
}

for (const operation of ['format:check', 'lint'] as const) {
  for (const owner of ['alpha', 'repository']) {
    test(`${operation} ${owner} ignores rules inside an excluded ancestor`, async () => {
      const tree = new QualityFixture();
      try {
        tree.owner('alpha', 'packages/alpha');
        tree.write('.prettierignore', '');
        tree.write('.gitignore', 'packages/alpha/generated/\n');
        tree.write('packages/alpha/generated/.gitignore', '!child/\n');
        tree.write('packages/alpha/generated/child/.gitignore', '!probe.ts\n');
        const path = 'packages/alpha/generated/child/probe.ts';
        tree.write(path, 'export const probe = 1;\n');
        assert(!(await selection(tree, operation, owner)).files.includes(path));
      } finally {
        tree.close();
      }
    });
  }
}
