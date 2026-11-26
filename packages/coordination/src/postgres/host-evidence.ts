import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

export type EvidenceRoots = string | readonly string[];

function contains(root: string, path: string) {
  const location = relative(root, path);
  return location && location !== '..' && !location.startsWith('..' + sep);
}

async function readArtifact(roots: readonly string[], path: string) {
  if (
    !isAbsolute(path) ||
    !roots.some((root) => contains(root, path)) ||
    (await realpath(path)) !== path
  )
    throw new Error('Recorded evidence is outside the mounted Host storage');
  const file = await lstat(path);
  if (!file.isFile() || file.nlink !== 1) throw new Error('Recorded evidence is unavailable');
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function canonicalRoot(root: string) {
  if ((await realpath(root)) !== root) throw new Error('An evidence root is an alias');
  return root;
}

/** Read only recorded JSON files under canonical, trusted evidence mounts. */
export async function readHostEvidence(roots: EvidenceRoots, sources: readonly string[]) {
  const directories = await Promise.all(
    (typeof roots === 'string' ? [roots] : roots).map(canonicalRoot),
  );
  return Promise.all(sources.map((source) => readArtifact(directories, source)));
}
