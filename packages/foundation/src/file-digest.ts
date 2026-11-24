import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** Identify file bytes without loading an entire artifact into memory. */
export async function fileDigest(path: string) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest('hex');
}
