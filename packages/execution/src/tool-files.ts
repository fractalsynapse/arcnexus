import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { ProjectSource } from '../../architecture/src/index.js';
import type { HostTask } from './index.js';
import { deletedSource } from './deleted-source.js';

/** Return complete permitted source from the requested offset and its current byte digest. */
export function readToolFile(task: HostTask, path: string, offset: number) {
  const file = accessibleFile(task, path);
  const bytes = readFileSync(file);
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  return fileContents(path, text, offset);
}

/** Read the exact committed file without accessing its worktree or interpreting it. */
export function capturedToolFile(source: ProjectSource, path: string, offset: number) {
  if (!(source.files ?? source.paths).includes(path))
    throw new Error(`File is not a regular captured file: ${path}`);
  return fileContents(path, source.read(path), offset);
}

/** List only directories and regular files present in the pinned tree. */
export function capturedToolDirectory(source: ProjectSource, path: string) {
  const prefix = path === '.' ? '' : path + '/';
  const entries = new Set<string>();
  for (const file of source.files ?? source.paths) {
    if (!file.startsWith(prefix)) continue;
    const name = file.slice(prefix.length);
    const slash = name.indexOf('/');
    entries.add(slash < 0 ? name : name.slice(0, slash + 1));
  }
  if (!entries.size && prefix) throw new Error(`Missing captured directory: ${path}`);
  return [...entries].sort();
}

function fileContents(path: string, text: string, offset: number) {
  return {
    path,
    sha256: createHash('sha256').update(text).digest('hex'),
    text: text.slice(offset),
  };
}

/** Refuse absent or aliased files while making a known checked deletion's preimage discoverable. */
function accessibleFile(task: HostTask, path: string) {
  const retained = isAbsolute(path) && task.journal.artifactRecorded(path);
  const file = task.evidence.includes(path) || retained ? path : projectPath(task, path);
  let stat;
  try {
    stat = lstatSync(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      const artifact = deletedSource(task, path);
      if (artifact)
        throw new Error(
          `${error.message}\nHistorical source: ${JSON.stringify(artifact)}\nCurrent expected hash: null. This is the exact prior checkpoint source, not current contents. Read the artifact with read-file, then restore only through an owned checked-edit with expected null and the retained text.`,
          { cause: error },
        );
    }
    throw error;
  }
  if (!stat.isFile() || stat.nlink !== 1 || realpathSync(file) !== file)
    throw new Error(`File is not an accessible regular file: ${path}`);
  return file;
}

/** List a workspace directory without traversing links or exposing Git control data. */
export function listToolDirectory(task: HostTask, path: string) {
  const directory = projectPath(task, path);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name !== '.git' && (entry.isFile() || entry.isDirectory()))
    .map((entry) => entry.name + (entry.isDirectory() ? '/' : ''))
    .sort();
}

/** Resolve workspace paths strictly within the admitted project root. */
function projectPath(task: HostTask, path: string) {
  const base = task.worktree ?? task.capture.source.root;
  if (path === '.') return base;
  if (
    isAbsolute(path) ||
    path
      .split('/')
      .some(
        (part) =>
          !part || ['..', '.', '.git'].includes(part) || part.includes('\\') || part.includes('\0'),
      )
  )
    throw new Error(`Path is not an admissible project path: ${path}`);
  const target = join(base, path);
  const parent = dirname(target);
  if (
    realpathSync(parent) !== parent ||
    (lstatSync(target, { throwIfNoEntry: false }) && realpathSync(target) !== target)
  )
    throw new Error(`Project path is an alias: ${path}`);
  return target;
}
