import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { registerSuite } from '../../../dist/library/testing/suite.js';

interface Suite {
  source: string;
  compiled: string;
}

/** Prevents runtime-dependent enforcement from disappearing between confined and native CI stages. */
class NativeSelectionScenarios {
  /** Compares actual built CLI selections against direct installed-runtime dependencies in test syntax. */
  selected(): void {
    const all = this.inspect();
    const native = new Set(this.inspect('native-host').map((suite) => suite.source));
    const required = all.filter((suite) =>
      this.requiresRuntime(readFileSync(suite.source, 'utf8')),
    );
    assert.ok(required.length > 0, 'Expected installed-runtime qualification suites');
    assert.deepEqual(
      required.filter((suite) => !native.has(suite.source)).map((suite) => suite.source),
      [],
      'Runtime-dependent suites must be selected by native qualification',
    );
  }

  /** Uses syntax rather than text matching so configuration and script fixture strings do not count. */
  requiresRuntime(text: string): boolean {
    const source = ts.createSourceFile('suite.ts', text, ts.ScriptTarget.Latest, true);
    let found = false;
    const visit = (node: ts.Node): void => {
      if (
        (ts.isPropertyAccessExpression(node) && node.name.text === 'ARCNEXUS_TEST_CODEX') ||
        (ts.isElementAccessExpression(node) &&
          ts.isStringLiteral(node.argumentExpression) &&
          node.argumentExpression.text === 'ARCNEXUS_TEST_CODEX')
      ) {
        const expression = node.expression;
        if (expression.getText(source) === 'process.env') found = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found || this.socketServer(source);
  }

  /** Recognizes direct calls to imported net factories, including named aliases and namespace imports. */
  private socketServer(source: ts.SourceFile): boolean {
    const factories = this.socketImports(source);
    let found = false;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && factories.has(node.expression.getText(source))) found = true;
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  }

  /** Collects only node:net factory bindings; fixture strings and unrelated method names grant no match. */
  private socketImports(source: ts.SourceFile): Set<string> {
    const factories = new Set<string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        statement.importClause?.isTypeOnly ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== 'node:net'
      )
        continue;
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      if (clause?.name) factories.add(clause.name.text + '.createServer');
      if (bindings && ts.isNamespaceImport(bindings))
        factories.add(bindings.name.text + '.createServer');
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements)
          if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === 'createServer')
            factories.add(binding.name.text);
    }
    return factories;
  }

  /** Reads production suite selection without starting a host or substituting a fixture catalog. */
  private inspect(tag?: string): Suite[] {
    const result = spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'test', 'inspect', '--json', ...(tag ? ['--tag', tag] : [])],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).suites;
  }
}

const scenarios = new NativeSelectionScenarios();

test('native CI selection includes all directly installed-runtime-dependent suites', () =>
  scenarios.selected());

test('native dependency detection distinguishes actual access from fixture strings', () => {
  assert.equal(
    scenarios.requiresRuntime('const fixture = "process.env.ARCNEXUS_TEST_CODEX";'),
    false,
  );
  assert.equal(
    scenarios.requiresRuntime('const installed = process.env.ARCNEXUS_TEST_CODEX;'),
    true,
  );
  assert.equal(
    scenarios.requiresRuntime('const installed = process.env["ARCNEXUS_TEST_CODEX"];'),
    true,
  );
});

test('native dependency detection recognizes host socket calls without matching unused imports', () => {
  assert.equal(scenarios.requiresRuntime("import { createServer } from 'node:net';"), false);
  assert.equal(
    scenarios.requiresRuntime(
      "const fixture = `import { createServer } from 'node:net'; createServer()`;",
    ),
    false,
  );
  assert.equal(
    scenarios.requiresRuntime("import { createServer } from 'node:net'; createServer();"),
    true,
  );
  assert.equal(
    scenarios.requiresRuntime("import { createServer as listen } from 'node:net'; listen();"),
    true,
  );
  assert.equal(
    scenarios.requiresRuntime("import * as net from 'node:net'; net.createServer();"),
    true,
  );
  assert.equal(
    scenarios.requiresRuntime("import { createServer } from 'other'; createServer();"),
    false,
  );
});

registerSuite({ component: 'release', level: 'acceptance', tags: ['deterministic', 'delivery'] });
