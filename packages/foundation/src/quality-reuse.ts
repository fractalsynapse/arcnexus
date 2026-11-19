import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface QualityReuseEligibility {
  eligible: boolean;
  reason?: string;
}

const executableFormatterConfigs = [
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
];

const unsupportedLintDependencies = [
  [/\brequire\s*\(/, 'CommonJS require dependency'],
  [/\bimport\s*\(/, 'dynamic import dependency'],
  [/\bexport\s*\{[^}]*\}\s*from\b/, 're-export dependency'],
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
    const config = readFileSync(resolve(root, path), 'utf8');
    if (/['"]?plugins?['"]?\s*:/i.test(config))
      return {
        eligible: false,
        reason: `Prettier configuration may load unselected plugin dependencies: ${path}`,
      };
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

/** Name the first executable formatter configuration that can load dependencies. */
function formatterConfigReason(directory: string, root: string): string | undefined {
  for (const name of executableFormatterConfigs) {
    const path = directory === '.' ? name : `${directory}/${name}`;
    if (existsSync(resolve(root, path)))
      return `Executable formatter configuration may load unselected dependencies: ${path}`;
  }
  return undefined;
}

/** Reject reuse for lint dependency forms that bounded static import traversal cannot resolve. */
function lintReuseEligibility(
  root: string,
  configurationInputs: readonly string[],
): QualityReuseEligibility {
  for (const path of configurationInputs) {
    if (!existsSync(resolve(root, path))) continue;
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const [pattern, description] of unsupportedLintDependencies) {
      if (pattern.test(source))
        return {
          eligible: false,
          reason: `ESLint dependency ${path} uses unsupported ${description}`,
        };
    }
  }
  return { eligible: true };
}
