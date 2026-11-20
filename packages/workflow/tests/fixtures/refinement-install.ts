import { chmodSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bind a real executable fixture outside source while keeping Git admission clean. */
export function installProvider(root: string) {
  const executable = join(root, '.git', 'refinement-provider.mjs');
  copyFileSync(
    fileURLToPath(new URL('../fixtures/refinement-provider.js', import.meta.url)),
    executable,
  );
  chmodSync(executable, 0o700);
  writeFileSync(
    join(root, '.git', 'bindings.yaml'),
    'schemaVersion: 1\ntools:\n  codex: ' + executable + '\n',
  );
  return executable;
}
