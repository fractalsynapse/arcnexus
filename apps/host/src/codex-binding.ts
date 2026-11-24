import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Set up the Host image's provider in a freshly provisioned checkout. */
export function prepareCodexBinding(directory: string, file: string | undefined) {
  if (
    !file ||
    !/^\.git\/(?:[\w.-]+\/)*[\w.-]+$/.test(file) ||
    file.split('/').some((part) => part === '..' || part === '.')
  )
    throw new Error('Missing or unsafe hosted Codex binding path');
  const path = join(directory, file);
  const parent = dirname(path);
  ensureDirectory(parent, join(directory, '.git'));
  if (!existsSync(path)) {
    writeFileSync(path, 'schemaVersion: 1\ntools:\n  codex: /usr/local/bin/codex\n', {
      flag: 'wx',
      mode: 0o600,
    });
  }
}

function ensureDirectory(path: string, git: string) {
  if (path !== git) {
    ensureDirectory(dirname(path), git);
    if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
  }
  if (realpathSync(path) !== path)
    throw new Error('Hosted Codex bindings require direct local paths');
}
