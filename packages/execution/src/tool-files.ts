import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { HostTask } from './index.js';

/** Read a permitted file and return a bounded text range and current byte digest. */
export function readToolFile(task: HostTask, path: string, offset: number) {
  const file = task.evidence.includes(path) ? path : projectPath(task, path);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || realpathSync(file) !== file)
    throw new Error(`File is not an accessible regular file: ${path}`);
  if (stat.size > 16_000_000) throw new Error(`File exceeds the tool's read limit: ${path}`);
  const bytes = readFileSync(file);
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const limit = Math.min(text.length, offset + 40_000);
  return {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    text: text.slice(offset, limit),
    nextOffset: limit < text.length ? limit : null,
  };
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
  if (realpathSync(target) !== target) throw new Error(`Project path is an alias: ${path}`);
  return target;
}
