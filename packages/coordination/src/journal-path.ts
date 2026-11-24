import { join } from 'node:path';
import { textDigest } from '../../foundation/src/index.js';

/** Resolve the physical journal location from its verified canonical remote. */
export function journalPath(storage: string, remote: string) {
  return join(storage, textDigest(remote), 'tasks.sqlite');
}
