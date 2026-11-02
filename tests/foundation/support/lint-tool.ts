import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Copies the installed lint dependency closure into a disposable, explicitly bound tool directory. */
export function bindLintTool(fixture: any): void {
  const root = join(fixture.root, 'lint-tool');
  const packages = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
  const pending = ['eslint'];
  const copied = new Set<string>();
  for (const name of pending) {
    if (copied.has(name)) continue;
    copied.add(name);
    const relative = 'node_modules/' + name;
    const definition = packages[relative];
    if (!definition) throw new Error('Missing installed lint dependency: ' + name);
    const target = join(root, relative);
    mkdirSync(join(target, '..'), { recursive: true });
    cpSync(resolve(relative), target, { recursive: true });
    pending.push(...dependencyNames(packages, relative));
  }
  const executable = join(root, 'lint.mjs');
  writeFileSync(
    executable,
    '#!/usr/bin/env node\nimport "./node_modules/eslint/bin/eslint.js";\n',
    { mode: 0o755 },
  );
  const path = join(fixture.root, 'minimal-bindings.json');
  const bindings = JSON.parse(readFileSync(path, 'utf8'));
  bindings.tools['lint-tool'] = executable;
  writeFileSync(path, JSON.stringify(bindings));
}

/** Includes dependencies of nested installed versions copied together with their parent package. */
function dependencyNames(packages: Record<string, any>, root: string): string[] {
  return Object.entries(packages)
    .filter(([path]) => path === root || path.startsWith(root + '/node_modules/'))
    .flatMap(([, definition]) => Object.keys(definition.dependencies ?? {}));
}
