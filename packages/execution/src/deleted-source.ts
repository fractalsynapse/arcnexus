import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { HostTask } from './index.js';
import { git, gitSource } from './git.js';

interface Deletion {
  editReceipt?: { path: string; before: string | null; after: string | null };
  checkpoint?: { head: string; parent: string };
}

/** Retain verified preimage bytes only for a recorded, checkpointed deletion of this project path. */
export function deletedSource(task: HostTask, path: string) {
  if (!task.worktree || isAbsolute(path)) return;
  const saved = task
    .observations<Deletion>()
    .findLast(({ editReceipt }) => editReceipt?.path === path);
  const { editReceipt, checkpoint } = saved ?? {};
  if (!editReceipt?.before || editReceipt.after !== null || !checkpoint) return;
  const { head, parent } = checkpoint;
  if (![head, parent].every((value) => /^[a-f0-9]{40,64}$/.test(value))) return;
  if (
    git(task.worktree, 'rev-parse', `${head}^`) !== parent ||
    git(task.worktree, 'merge-base', head, 'HEAD') !== head
  )
    throw new Error(`Deleted-source checkpoint is not retained ancestry: ${path}`);
  const text = gitSource(task.worktree, parent, path);
  if (createHash('sha256').update(text).digest('hex') !== editReceipt.before)
    throw new Error(`Deleted-source bytes differ from the acknowledged receipt: ${path}`);
  const name = `deleted-source-${editReceipt.before}.txt`;
  const artifact =
    task.evidence.findLast((entry) => entry.endsWith(`-${name}`) && existsSync(entry)) ??
    task.store(name, text);
  return artifact;
}
