import ts from 'typescript';
import type { CapturedProgram } from './captured-program.js';

export interface SourceImport {
  specifier: string;
  symbols: string[];
  typeOnly: boolean;
}

/** Extracts actual imported names, including namespace uses that could escape a narrowed boundary. */
export class ImportSymbols {
  /** Uses compiler identity so unrelated identifiers with the same spelling do not become imports. */
  constructor(private readonly program: CapturedProgram) {}

  /** Collects supported static declarations and explicit unresolved dynamic calls from one source file. */
  read(source: ts.SourceFile): SourceImport[] {
    const imports: SourceImport[] = [];
    const visit = (node: ts.Node): void => {
      const reference = this.reference(node, source);
      if (reference) imports.push(reference);
      ts.forEachChild(node, visit);
    };
    visit(source);
    return imports;
  }

  /** Recognizes static module declarations, runtime calls and erased TypeScript import forms. */
  private reference(node: ts.Node, source: ts.SourceFile): SourceImport | undefined {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      return ts.isImportDeclaration(node) ? this.declaration(node, source) : this.reexport(node);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      return this.call(node, source);
    return this.typeReference(node, source);
  }

  /** Resolves require aliases and type queries so alternative syntax cannot evade a named public boundary. */
  private typeReference(node: ts.Node, source: ts.SourceFile): SourceImport | undefined {
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression && ts.isStringLiteralLike(expression))
        return {
          specifier: expression.text,
          symbols: this.namespace(node.name, source),
          typeOnly: node.isTypeOnly,
        };
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      let qualifier = node.qualifier;
      while (qualifier && ts.isQualifiedName(qualifier)) qualifier = qualifier.left;
      return {
        specifier: node.argument.literal.text,
        symbols: [qualifier?.text ?? '*'],
        typeOnly: true,
      };
    }
    return undefined;
  }

  /** Resolves named, default, type-only and namespace declarations without granting the whole module implicitly. */
  private declaration(node: ts.ImportDeclaration, source: ts.SourceFile): SourceImport {
    const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const clause = node.importClause;
    const binding = clause?.namedBindings;
    const names =
      binding && ts.isNamedImports(binding)
        ? binding.elements.map((entry) => (entry.propertyName ?? entry.name).text)
        : binding
          ? this.namespace(binding.name, source)
          : [];
    return {
      specifier,
      symbols: [...(clause?.name ? ['default'] : []), ...names],
      typeOnly: Boolean(
        clause?.isTypeOnly ||
        (!clause?.name &&
          binding &&
          ts.isNamedImports(binding) &&
          binding.elements.length > 0 &&
          binding.elements.every((entry) => entry.isTypeOnly)),
      ),
    };
  }

  /** Preserves named type-only re-exports while treating wildcard namespace exposure conservatively. */
  private reexport(node: ts.ExportDeclaration): SourceImport {
    const elements =
      node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements
        : undefined;
    return {
      specifier: (node.moduleSpecifier as ts.StringLiteral).text,
      symbols: elements ? elements.map((entry) => (entry.propertyName ?? entry.name).text) : ['*'],
      typeOnly:
        node.isTypeOnly || Boolean(elements?.length && elements.every((entry) => entry.isTypeOnly)),
    };
  }

  /** Records runtime module calls conservatively when destructuring or static property use is unavailable. */
  private call(node: ts.CallExpression, source: ts.SourceFile): SourceImport {
    const argument = node.arguments[0];
    const specifier = argument && ts.isStringLiteralLike(argument) ? argument.text : '<dynamic>';
    const parent = node.parent;
    let symbols = ['*'];
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
      symbols = [parent.name.text];
    if (
      ts.isElementAccessExpression(parent) &&
      parent.expression === node &&
      ts.isStringLiteralLike(parent.argumentExpression)
    )
      symbols = [parent.argumentExpression.text];
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
      symbols = this.namespace(parent.name, source);
    if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name))
      symbols = parent.name.elements.map((entry) =>
        entry.dotDotDotToken ? '*' : (entry.propertyName ?? entry.name).getText(source),
      );
    return { specifier, symbols, typeOnly: false };
  }

  /** Treats namespace escape and dynamic property access as access to every exported name. */
  private namespace(binding: ts.Identifier, source: ts.SourceFile): string[] {
    const identity = this.identity(binding);
    if (!identity) return ['*'];
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node !== binding && this.identity(node) === identity) {
        const parent = node.parent;
        if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
          names.add(parent.name.text);
        else if (
          ts.isElementAccessExpression(parent) &&
          parent.expression === node &&
          ts.isStringLiteralLike(parent.argumentExpression)
        )
          names.add(parent.argumentExpression.text);
        else names.add('*');
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return [...names].sort();
  }

  /** Follows aliases to compare namespace imports and exports through their actual module identity. */
  private identity(node: ts.Identifier): ts.Symbol | undefined {
    const symbol = this.program.checker.getSymbolAtLocation(node);
    return symbol && symbol.flags & ts.SymbolFlags.Alias
      ? this.program.checker.getAliasedSymbol(symbol)
      : symbol;
  }
}
