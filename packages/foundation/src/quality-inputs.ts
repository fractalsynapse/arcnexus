import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import ts from 'typescript';

/** Follow parsed local imports from quality configuration without hashing unrelated source. */
export function configurationInputs(operation: 'format:check' | 'lint', root: string): string[] {
  const pending = operation === 'lint' ? ['eslint.config.ts'] : [];
  const visited = new Set<string>();
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readConfigurationFile(path, root);
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith('.')) continue;
      const resolved = normalize(join(dirname(path), specifier));
      const base = resolved.replace(/\.(?:[cm]?[jt]sx?)$/, '');
      const candidates = [
        resolved,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.cts`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}.mjs`,
        `${base}.cjs`,
      ];
      const dependency = candidates.find((candidate) => readConfigurationFile(candidate, root) !== '');
      pending.push(dependency ?? resolved);
    }
  }
  return [...visited].sort();
}

/** Read a configuration edge when present so absent imports remain visible to eligibility. */
function readConfigurationFile(path: string, root: string): string {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}
