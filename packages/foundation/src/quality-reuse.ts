import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface QualityReuseEligibility {
  eligible: boolean;
  reason?: string;
}

/** Decline reuse when bounded configuration discovery cannot cover executable inputs. */
export function qualityReuseEligibility(
  operation: 'format:check' | 'lint',
  files: readonly string[],
  root: string,
): QualityReuseEligibility {
  if (operation === 'format:check') {
    const executableConfig = /^(?:\.prettierrc\.(?:[cm]?js|ts)|prettier\.config\.(?:[cm]?js|ts))$/;
    for (const file of files) {
      let directory = dirname(file);
      while (directory !== '.') {
        const path = resolve(root, directory);
        for (const name of [
          '.prettierrc.js',
          '.prettierrc.cjs',
          '.prettierrc.mjs',
          '.prettierrc.ts',
          'prettier.config.js',
          'prettier.config.cjs',
          'prettier.config.mjs',
          'prettier.config.ts',
        ]) {
          if (executableConfig.test(name) && existsSync(resolve(path, name)))
            return {
              eligible: false,
              reason: `Executable formatter configuration may load unselected dependencies: ${directory}/${name}`,
            };
        }
        directory = dirname(directory);
      }
      for (const name of [
        '.prettierrc.js',
        '.prettierrc.cjs',
        '.prettierrc.mjs',
        '.prettierrc.ts',
        'prettier.config.js',
        'prettier.config.cjs',
        'prettier.config.mjs',
        'prettier.config.ts',
      ]) {
        if (existsSync(resolve(root, name)))
          return {
            eligible: false,
            reason: `Executable formatter configuration may load unselected dependencies: ${name}`,
          };
      }
    }
  }
  if (operation === 'lint') {
    const config = readFileSync(resolve(root, 'eslint.config.ts'), 'utf8');
    for (const [pattern, description] of [
      [/\brequire\s*\(/, 'CommonJS require dependency'],
      [/\bimport\s*\(/, 'dynamic import dependency'],
      [/\bexport\s*\{[^}]*\}\s*from\b/, 're-export dependency'],
    ] as const) {
      if (pattern.test(config))
        return { eligible: false, reason: `ESLint configuration uses unsupported ${description}` };
    }
  }
  return { eligible: true };
}
