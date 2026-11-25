import { readFileSync } from 'node:fs';

/** Read a mounted credential without putting its bytes in process arguments. */
export function readSecret(file: string) {
  const secret = readFileSync(file, 'utf8').trim();
  if (!secret) throw new Error('A configured secret file is empty');
  return secret;
}
