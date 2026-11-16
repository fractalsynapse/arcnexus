import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Capture } from '../../architecture/src/index.js';

export interface CheckedEdit {
  path: string;
  expected: string | null;
  content: string | null;
}

/** Authorize every proposed edit against captured ownership and its observed bytes before writing. */
export function applyEdits(
  root: string,
  capture: Capture,
  owner: string,
  edits: readonly CheckedEdit[],
) {
  const paths = new Set<string>();
  const validated = edits.map((edit) => {
    const path = authorize(root, capture, owner, edit.path);
    if (paths.has(path)) throw new Error(`Duplicate checked edit: ${edit.path}`);
    paths.add(path);
    const previous = safeRead(path);
    const before = previous === undefined ? null : digest(previous);
    if (before !== edit.expected) throw new Error(`Stale checked edit: ${edit.path}`);
    if (typeof edit.content !== 'string' && edit.content !== null)
      throw new Error(`Invalid replacement content: ${edit.path}`);
    return { path, edit, before, previous };
  });
  return validated.map(({ path, edit, before }) => {
    replace(path, edit.content);
    return { path: edit.path, before, after: edit.content === null ? null : digest(edit.content) };
  });
}

/** Enforce unique ownership and reject lock changes and file aliases. */
function authorize(root: string, capture: Capture, owner: string, path: string) {
  const segments = pathSegments(path);
  if (
    capture.project.contractRegistry === path ||
    capture.contracts.some((entry) => entry.stage === 'locked' && entry.file === path)
  )
    throw new Error(`Locked contract or registry: ${path}`);
  const owners = Object.values(capture.components).filter((entry) =>
    entry.owns.some((owned) => path === owned || path.startsWith(owned + '/')),
  );
  if (owners.length !== 1 || owners[0]?.id !== owner)
    throw new Error(
      `Checked edit refused for ${path}; captured owners: ${owners.map(({ id }) => id).join(', ') || 'none'}`,
    );
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    const info = stat(current);
    if (info?.isSymbolicLink() || (info?.isFile() && info.nlink !== 1))
      throw new Error(`Unsafe checked edit alias: ${path}`);
  }
  return current;
}

/** Parse a repository-relative path while rejecting Git metadata and traversal. */
function pathSegments(path: string) {
  const segments = path.split('/');
  if (
    segments.some(
      (part) =>
        !part ||
        part === '..' ||
        part === '.' ||
        part === '.git' ||
        part.includes('\\') ||
        part.includes('\0'),
    )
  )
    throw new Error(`Unsafe checked edit path: ${path}`);
  return segments;
}

/** Return an absent path separately from unreadable storage. */
function stat(path: string) {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Refuse devices, directories and aliases as file content sources. */
function safeRead(path: string) {
  const info = stat(path);
  if (!info) return;
  if (!info.isFile() || info.nlink !== 1)
    throw new Error(`Not a regular checked edit file: ${path}`);
  return readFileSync(path);
}

/** Replace one file atomically beside its previous version. */
function replace(path: string, content: string | null) {
  if (content === null) {
    rmSync(path, { force: true });
    return;
  }
  const mode = stat(path)?.mode ?? 0o644;
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.arcnexus-${randomUUID()}`);
  try {
    writeFileSync(temp, content, { mode, flag: 'wx' });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** Compute the identity of checked file bytes. */
function digest(bytes: string | Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}
