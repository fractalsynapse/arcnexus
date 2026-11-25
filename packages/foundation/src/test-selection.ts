import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type ts from 'typescript';

export interface TestFilter {
  tags?: readonly string[];
  levels?: readonly string[];
  paths?: readonly string[];
}

/** Parse test selection once for human and architecture-driven callers without an invocation budget. */
export class TestSelection implements TestFilter {
  owner?: string;
  readonly tags: string[] = [];
  readonly levels: string[] = [];
  readonly paths: string[] = [];
  native?: boolean;

  /** Validate every argument before any test suite can execute. */
  constructor(args: readonly string[]) {
    for (let index = 0; index < args.length; index++) {
      const argument = args[index]!;
      if (!argument.startsWith('-')) {
        assert(!this.owner, `Only one test owner can be selected: ${argument}`);
        this.owner = argument;
      } else {
        assert(
          ['--tag', '--level', '--path', '--native'].includes(argument),
          `Unknown test option: ${argument}`,
        );
        const value = args[++index];
        assert(value && !value.startsWith('--'), `Missing value for ${argument}`);
        this.option(argument, value);
      }
    }
  }

  /** Resolve the child opt-in and refuse a claimed native selection that would leave its native cases disabled. */
  environment(parent: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const environment = { ...parent };
    if (this.native !== undefined) environment.ARCNEXUS_NATIVE_TESTS = this.native ? '1' : '0';
    assert(
      !this.tags.includes('native') || environment.ARCNEXUS_NATIVE_TESTS === '1',
      'Explicit native suite selection requires native opt-in; native execution is disabled',
    );
    return environment;
  }

  /** Keep named selectors explicit and preserve the caller's repeated tag/level alternatives. */
  private option(option: string, value: string) {
    if (option === '--tag') this.tags.push(value);
    if (option === '--path') this.paths.push(value);
    if (option === '--level') {
      assert(['unit', 'integration', 'acceptance'].includes(value), `Unknown test level: ${value}`);
      this.levels.push(value);
    }
    if (option === '--native') {
      assert(['true', 'false'].includes(value), 'native requires true or false');
      this.native = value === 'true';
    }
  }
}

/** Apply independent selector dimensions to registered suites without changing ownership or executing code. */
export function matchesTestFilter(
  suite: { file: string; level: string; tags: string[] },
  filter: TestFilter,
) {
  if (filter.levels?.length && !filter.levels.includes(suite.level)) return false;
  if (filter.tags?.length && !suite.tags.some((tag) => filter.tags!.includes(tag))) return false;
  const source = suite.file.replace(/^dist\//, '').replace(/\.js$/, '.ts');
  return (
    !filter.paths?.length ||
    filter.paths.some((input) => {
      const path = input.replace(/^\.\//, '').replace(/\/$/, '');
      return [source, suite.file].some((file) => file === path || file.startsWith(path + '/'));
    })
  );
}

interface SuiteMetadata {
  owner: string;
  level: string;
  tags: string[];
}

/** Read literal suite metadata without importing tests or loading TypeScript for ordinary agent requests. */
export class SuiteMetadataReader {
  private readonly parser: typeof import('typescript');

  /** Load the installed parser only for actual test discovery, leaving unrelated startup lightweight. */
  constructor(private readonly path: string) {
    this.parser = createRequire(import.meta.url)('typescript') as typeof import('typescript');
  }

  /** Inspect exported declarations without evaluating their expressions or executing suite code. */
  read(text: string): SuiteMetadata {
    const ts = this.parser;
    const source = ts.createSourceFile(this.path, text, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
        continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'suite') continue;
        return this.metadata(declaration.initializer);
      }
    }
  }

  /** Require literal scalar and tag fields rather than silently guessing computed metadata. */
  private metadata(initializer: ts.Expression | undefined): SuiteMetadata {
    const ts = this.parser;
    while (
      initializer &&
      (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer))
    )
      initializer = initializer.expression;
    assert(
      initializer && ts.isObjectLiteralExpression(initializer),
      `Expected literal suite metadata: ${this.path}`,
    );
    const fields = this.fields(initializer);
    const tags = fields.get('tags');
    assert(tags && ts.isArrayLiteralExpression(tags), `Expected literal suite tags: ${this.path}`);
    return {
      owner: this.literal(fields.get('owner'), 'owner'),
      level: this.literal(fields.get('level'), 'level'),
      tags: tags.elements.map((entry) => this.literal(entry, 'tag')),
    };
  }

  /** Refuse repeated or computed fields before any selection could hide an invalid declaration. */
  private fields(object: ts.ObjectLiteralExpression) {
    const ts = this.parser;
    const fields = new Map<string, ts.Expression>();
    for (const property of object.properties) {
      assert(
        ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)),
        `Expected literal suite metadata: ${this.path}`,
      );
      assert(
        !fields.has(property.name.text),
        `Duplicate suite metadata ${property.name.text}: ${this.path}`,
      );
      fields.set(property.name.text, property.initializer);
    }
    return fields;
  }

  /** Preserve declared text exactly and name the field in rejected expression diagnostics. */
  private literal(value: ts.Node | undefined, field: string) {
    assert(
      value && this.parser.isStringLiteral(value),
      `Expected literal suite ${field}: ${this.path}`,
    );
    return value.text;
  }
}
