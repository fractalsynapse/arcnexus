import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import * as foundation from '../../src/index.js';
import { testInventory } from '../../src/index.js';

type Operation = 'format:check' | 'lint';

/** Isolate command inputs while using the repository's actual tooling and configuration. */
class QualityFixture {
  readonly root: string;

  /** Copy tool inputs into a declared generated root and share installed dependencies. */
  constructor() {
    mkdirSync('.test-build', { recursive: true });
    this.root = mkdtempSync(resolve('.test-build/quality-'));
    for (const path of [
      'package.json',
      '.prettierignore',
      '.prettierrc.yaml',
      'eslint.config.ts',
      'packages/foundation/scripts',
      'packages/foundation/src',
      'packages/team/src',
    ]) {
      mkdirSync(join(this.root, path, '..'), { recursive: true });
      cpSync(path, join(this.root, path), { recursive: true });
    }
    symlinkSync(resolve('node_modules'), join(this.root, 'node_modules'), 'dir');
    mkdirSync(join(this.root, '.arc/architecture/components'), { recursive: true });
    this.write(
      '.arc/architecture/components/tooling.yaml',
      'id: tooling\nowns:\n- package.json\n- .prettierignore\n- .prettierrc.yaml\n- eslint.config.ts\n- packages/foundation\n- packages/team\n',
    );
  }

  /** Define a synthetic owner without changing the captured repository catalog. */
  owner(id: string, path: string) {
    this.write(`.arc/architecture/components/${id}.yaml`, `id: ${id}\nowns:\n- ${path}\n`);
  }

  /** Create an input in the isolated task tree. */
  write(path: string, content: string) {
    const target = join(this.root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }

  /** Invoke the public command and retain its exit and diagnostics. */
  run(operation: Operation, owner?: string) {
    const args = ['run', operation, ...(owner ? ['--', owner] : [])];
    const result = spawnSync('npm', args, { cwd: this.root, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    return { status: result.status, output: result.stdout + result.stderr };
  }

  /** Remove generated fixture inputs after the test. */
  close() {
    rmSync(this.root, { recursive: true, force: true });
  }
}

/** Provide independent owners whose newly created files differ in quality. */
function fixture() {
  const tree = new QualityFixture();
  tree.owner('alpha', 'packages/alpha');
  tree.owner('beta', 'packages/beta');
  tree.write('packages/alpha/probe.ts', 'export const alpha = 1;\n');
  tree.write('packages/beta/probe.ts', 'const unused=1\n');
  return tree;
}

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

test('Foundation exposes quality selection to applicability consumers', () => {
  assert.equal(typeof Reflect.get(foundation, 'selectQualityInputs'), 'function');
});

test('lint includes CommonJS files in its repository-wide coverage', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('packages/alpha/probe.cjs', 'const unused = 1;\n');
    const result = tree.run('lint');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /probe\.cjs/);
  } finally {
    tree.close();
  }
});

test('format retains the existing coverage instead of formatting arbitrary nested JSON', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'other');
    tree.write('other/probe.json', '{"value":1}\n');
    const result = tree.run('format:check', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('discovery excludes currently ignored generated inputs', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('.gitignore', 'packages/alpha/generated/\n');
    tree.write('packages/alpha/generated/probe.ts', 'const unused=1\n');
    const result = tree.run('lint', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('unowned maintained inputs are rejected with their path', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('packages/orphan/probe.ts', 'export const probe = 1;\n');
    const result = tree.run('lint', 'alpha');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /packages\/orphan\/probe\.ts/);
  } finally {
    tree.close();
  }
});

test('lint honors configuration ignores for owner applicability', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('alpha', 'packages/alpha');
    tree.write('eslint.config.ts', "export default [{ ignores: ['packages/alpha/**'] }];\n");
    tree.write('packages/alpha/probe.ts', 'const unused = 1;\n');
    const result = tree.run('lint', 'alpha');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /empty|no applicable/i);
  } finally {
    tree.close();
  }
});

test('quality identity changes when configuration changes without changing selected files', () => {
  const tree = fixture();
  try {
    const before = tree.run('format:check', 'alpha');
    tree.write('.prettierrc.yaml', 'singleQuote: true\n');
    const after = tree.run('format:check', 'alpha');
    const identity = /sha256=([a-f0-9]+)/;
    assert.match(before.output, identity);
    assert.match(after.output, identity);
    assert.notEqual(before.output.match(identity)?.[1], after.output.match(identity)?.[1]);
  } finally {
    tree.close();
  }
});

test('quality commands preserve the owner test inventory and selection', () => {
  const all = testInventory();
  const selected = testInventory('foundation');
  assert(selected.length > 0);
  assert.deepEqual(
    selected,
    all.filter(({ owner }) => owner === 'foundation'),
  );
  const tree = fixture();
  try {
    tree.run('format:check', 'beta');
    tree.run('lint', 'beta');
    assert.deepEqual(testInventory(), all);
    assert.deepEqual(testInventory('foundation'), selected);
  } finally {
    tree.close();
  }
});

test('an owner with only JSON has an empty lint selection but a format selection', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('json-owner', 'packages/json-owner');
    tree.write('packages/json-owner/probe.json', '{"value":1}\n');
    const format = tree.run('format:check', 'json-owner');
    assert.notEqual(format.status, 0, format.output);
    assert.match(format.output, /packages\/json-owner\/probe\.json/);
    const lint = tree.run('lint', 'json-owner');
    assert.equal(lint.status, 0, lint.output);
    assert.match(
      lint.output,
      /lint.*(empty|no applicable|inapplicable)|(empty|no applicable|inapplicable).*lint/i,
    );
  } finally {
    tree.close();
  }
});

test('a Prettier-ignored TypeScript file leaves format empty but remains lint applicable', () => {
  const tree = new QualityFixture();
  try {
    tree.owner('ignored-owner', 'packages/ignored-owner');
    tree.write('.prettierignore', 'packages/ignored-owner/probe.ts\n');
    tree.write('packages/ignored-owner/probe.ts', 'const unused = 1;\n');
    const format = tree.run('format:check', 'ignored-owner');
    assert.equal(format.status, 0, format.output);
    assert.match(
      format.output,
      /format.*(empty|no applicable|inapplicable)|(empty|no applicable|inapplicable).*format/i,
    );
    const lint = tree.run('lint', 'ignored-owner');
    assert.notEqual(lint.status, 0, lint.output);
    assert.match(lint.output, /packages\/ignored-owner\/probe\.ts/);
    assert.match(lint.output, /no-unused-vars/);
  } finally {
    tree.close();
  }
});

/** Read public applicability in the isolated worktree. */
async function selection(tree: QualityFixture, operation: Operation, owner: string | undefined = 'alpha') {
  const previous = process.cwd();
  try {
    process.chdir(tree.root);
    return await foundation.selectQualityInputs(operation, owner === 'repository' ? undefined : owner);
  } finally {
    process.chdir(previous);
  }
}

for (const extension of ['yaml', 'yml']) {
  test(`format selects maintained ${extension} files`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      const path = `packages/alpha/probe.${extension}`;
      tree.write(path, 'value: 1\n');
      assert((await selection(tree, 'format:check')).files.includes(path));
    } finally {
      tree.close();
    }
  });
}

test('public quality identity changes when selected source contents change', async () => {
  const tree = fixture();
  try {
    const before = await selection(tree, 'format:check');
    tree.write('packages/alpha/probe.ts', 'export const alpha = 2;\n');
    const after = await selection(tree, 'format:check');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

test('public lint identity changes when an imported configuration changes', async () => {
  const tree = fixture();
  try {
    tree.write(
      'eslint.config.ts',
      "import rules from './readability-rules.ts';\nexport default [rules];\n",
    );
    tree.write('readability-rules.ts', 'export default {};\n');
    const before = await selection(tree, 'lint');
    tree.write('readability-rules.ts', 'export default { rules: {} };\n');
    const after = await selection(tree, 'lint');
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.identity, before.identity);
  } finally {
    tree.close();
  }
});

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

for (const extension of ['jsx', 'tsx']) {
  test(`lint discovers configuration-enabled ${extension} files`, async () => {
    const tree = new QualityFixture();
    try {
      tree.owner('alpha', 'packages/alpha');
      tree.write('eslint.config.ts', `export default [{ files: ['**/*.${extension}'] }];\n`);
      const path = `packages/alpha/probe.${extension}`;
      tree.write(path, 'export const probe = 1;\n');
      assert((await selection(tree, 'lint')).files.includes(path));
    } finally {
      tree.close();
    }
  });
}
