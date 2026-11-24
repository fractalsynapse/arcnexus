import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/** Verify registered artifacts at the stable Host paths included in the cutover receipt. */
export async function verifyCutoverArtifacts(database: DatabaseSync, storage: string) {
  const root = await realpath(storage);
  const digests: Record<string, string> = {};
  const paths = database
    .prepare(
      "SELECT DISTINCT json_extract(content, '$.artifact') AS path FROM events WHERE json_type(content, '$.artifact') = 'text' ORDER BY path",
    )
    .iterate();
  for (const { path } of paths) {
    const identity = String(path);
    const actual = await realpath(identity);
    const location = relative(root, actual);
    if (
      !isAbsolute(identity) ||
      !location ||
      location === '..' ||
      location.startsWith('..' + sep) ||
      !(await stat(actual)).isFile()
    )
      throw new Error('Recorded artifact is outside the retained Host storage: ' + identity);
    const digest = createHash('sha256');
    for await (const bytes of createReadStream(actual)) digest.update(bytes);
    digests[identity] = digest.digest('hex');
  }
  return digests;
}
