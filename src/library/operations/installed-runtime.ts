import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Identifies the installed supervisor once for host provenance and dependency preparation. */
export function installedRuntime(): { directory: string; hash: string } {
  const directory = fileURLToPath(new URL('../../../', import.meta.url));
  const hash = createHash('sha256');
  for (const path of ['dist', 'package.json', 'package-lock.json'])
    hashRuntime(directory, path, hash);
  return { directory, hash: hash.digest('hex') };
}

/** Fingerprints executable bytes and modes without creating a per-run executable copy. */
function hashRuntime(directory: string, path: string, hash: ReturnType<typeof createHash>): void {
  const absolute = join(directory, path);
  const stat = statSync(absolute);
  hash.update(JSON.stringify([path, stat.mode & 0o777]));
  if (stat.isDirectory())
    for (const name of readdirSync(absolute).sort()) hashRuntime(directory, join(path, name), hash);
  else if (stat.isFile()) hash.update(readFileSync(absolute));
  else throw new Error('Unsupported installed runtime input: ' + absolute);
}
