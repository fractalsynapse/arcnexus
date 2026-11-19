import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import ts from 'typescript';

export interface QualityReuseEligibility {
  eligible: boolean;
  reason?: string;
}

const executableFormatterConfigs = [
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  '.prettierrc.mts',
  '.prettierrc.cts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
  'prettier.config.mts',
  'prettier.config.cts',
];

const unsupportedLintDependencies = [
  [/\brequire\s*\(/, 'CommonJS require dependency'],
  [/\bimport\s*\(/, 'dynamic import dependency'],
  [/\bexport\s*\{[^}]*\}\s*from\b/, 're-export dependency'],
  [/\bexport\s+\*\s*(?:as\s+\w+\s*)?from\b/, 'export-star dependency'],
  [/\bfrom\s*['"](?:node:)?fs(?:\/[^'"]*)?['"]/, 'filesystem-reading dependency'],
  [/\bimport\s*['"](?!\.\.?\/|\/|node:)[^'"]+['"]/, 'bare package dependency'],
  [/\bfrom\s*['"](?!\.\.?\/|\/|node:)[^'"]+['"]/, 'bare package dependency'],
  [/\b(?:readFile|readFileSync|readdir|readdirSync|watch)\s*\(/, 'filesystem-reading dependency'],
] as const;

/** Decline reuse when bounded configuration discovery cannot cover executable inputs. */
export function qualityReuseEligibility(
  operation: 'format:check' | 'lint',
  files: readonly string[],
  root: string,
  configurationInputs: readonly string[] = [],
  formatterInputs: readonly string[] = [],
): QualityReuseEligibility {
  if (operation === 'format:check') return formatterReuseEligibility(files, root, formatterInputs);
  if (operation === 'lint') return lintReuseEligibility(root, configurationInputs);
  return { eligible: true };
}

/** Find executable formatter settings above any selected input. */
function formatterReuseEligibility(
  files: readonly string[],
  root: string,
  formatterInputs: readonly string[],
): QualityReuseEligibility {
  for (const path of formatterInputs) {
    const reason = formatterInputReason(path, root);
    if (reason) return { eligible: false, reason };
  }
  for (const file of files) {
    let directory = dirname(file);
    while (directory !== '.') {
      const reason = formatterConfigReason(directory, root);
      if (reason) return { eligible: false, reason };
      directory = dirname(directory);
    }
    const reason = formatterConfigReason('.', root);
    if (reason) return { eligible: false, reason };
  }
  return { eligible: true };
}

/** Validate one collected formatter configuration without evaluating it. */
function formatterInputReason(path: string, root: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = parse(readFileSync(resolve(root, path), 'utf8'));
  } catch {
    return `Prettier configuration cannot be inspected safely: ${path}`;
  }
  const value = /(?:^|\/)package\.json$/.test(path) && isRecord(parsed) ? parsed.prettier : parsed;
  if (value === undefined) return undefined;
  if (typeof value === 'string')
    return `Prettier configuration references an uncovered shareable config: ${path}`;
  if (!isRecord(value)) return `Prettier configuration has an unsupported shape: ${path}`;
  return containsPluginOption(value)
    ? `Prettier configuration may load unselected plugin dependencies: ${path}`
    : undefined;
}

/** Name the first executable formatter configuration that can load dependencies. */
function formatterConfigReason(directory: string, root: string): string | undefined {
  for (const name of executableFormatterConfigs) {
    const path = directory === '.' ? name : `${directory}/${name}`;
    if (existsSync(resolve(root, path)))
      return `Executable formatter configuration may load unselected dependencies: ${path}`;
  }
  return undefined;
}

/** Check whether parsed configuration data is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Find plugin options at any nested formatter override depth. */
function containsPluginOption(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPluginOption);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => key === 'plugins' || containsPluginOption(nested),
  );
}

/** Reject reuse for lint dependency forms that bounded static import traversal cannot resolve. */
function lintReuseEligibility(
  root: string,
  configurationInputs: readonly string[],
): QualityReuseEligibility {
  for (const path of configurationInputs) {
    if (!existsSync(resolve(root, path)))
      return { eligible: false, reason: `ESLint dependency coverage is incomplete at ${path}` };
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const [pattern, description] of unsupportedLintDependencies) {
      if (pattern.test(source))
        return {
          eligible: false,
          reason: `ESLint dependency ${path} uses unsupported ${description}`,
        };
    }
    const reason = staticLintModuleReason(source, path);
    if (reason) return { eligible: false, reason };
  }
  return { eligible: true };
}

/** Recognize only literal data modules and relative default-import references. */
function staticLintModuleReason(source: string, path: string): string | undefined {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imported = new Set<string>();
  let hasDefault = false;

  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('./') &&
      statement.importClause?.name &&
      !statement.importClause.isTypeOnly
    ) {
      if (!/\.[cm]?[jt]sx?$/.test(statement.moduleSpecifier.text))
        return `ESLint dependency ${path} has uncertain extensionless import resolution: ${statement.moduleSpecifier.text}`;
      imported.add(statement.importClause.name.text);
      continue;
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals && !hasDefault) {
      hasDefault = true;
      if (isStaticData(statement.expression, imported)) continue;
    }
    return `ESLint configuration ${path} contains syntax outside the supported static subset`;
  }

  return hasDefault ? undefined : `ESLint configuration ${path} has no supported default export`;
}

/** Accept recursively literal objects, arrays and imported default bindings. */
function isStaticData(node: ts.Expression, imported: ReadonlySet<string>): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  )
    return true;
  if (ts.isIdentifier(node)) return imported.has(node.text);
  if (ts.isArrayLiteralExpression(node))
    return node.elements.every(
      (element) => ts.isExpression(element) && isStaticData(element, imported),
    );
  if (!ts.isObjectLiteralExpression(node)) return false;
  return node.properties.every(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) ||
        ts.isStringLiteral(property.name) ||
        ts.isNumericLiteral(property.name)) &&
      isStaticData(property.initializer, imported),
  );
}
