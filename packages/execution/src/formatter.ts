import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatContents } from './check.js';
import { checkedInput, type CheckedEdit } from './edits.js';
import type { HostTask } from './index.js';

/** Find the installed project formatter and reject aliases outside the resolved checkout. */
export function formatterPreview(root: string) {
  const entry = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!existsSync(entry) || realpathSync(entry) !== entry || !lstatSync(entry).isFile())
    return undefined;
  return { entry, root: dirname(dirname(entry)) };
}

export interface TransformEdit {
  path: string;
  expected: string;
  transform: { format: boolean; replace?: { before: string; after: string } };
}

export type ProposedEdit = CheckedEdit | TransformEdit;

/** Resolve compact edits to exact replacement bytes before any task file changes. */
export async function materializeEdits(
  task: HostTask,
  owner: string,
  proposals: readonly ProposedEdit[],
  signal: AbortSignal,
): Promise<CheckedEdit[]> {
  const edits: CheckedEdit[] = [];
  for (const edit of proposals) {
    signal.throwIfAborted();
    edits.push('transform' in edit ? await materialize(task, owner, edit, signal) : edit);
  }
  return edits;
}

/** Verify ownership and the pre-edit hash before transforming existing source. */
async function materialize(
  task: HostTask,
  owner: string,
  edit: TransformEdit,
  signal: AbortSignal,
) {
  const worktree = task.worktree;
  if (!worktree) throw new Error('Checked transforms require a prepared worktree');
  const { path, expected, transform } = edit;
  const input = checkedInput(worktree, task.capture, owner, edit);
  const updated = transform.replace ? replaceOnce(input, transform.replace, path) : input;
  if (!transform.format) return { path, expected, content: updated };
  if (!task.formatPreview) throw new Error('Installed project formatter unavailable');
  const log = task.artifact('format.log');
  const content = await formatContents(
    task.capture.source.root,
    worktree,
    task.config.common,
    path,
    updated,
    log,
    signal,
  );
  return { path, expected, content };
}

/** Replace a literal only if it uniquely identifies the original range. */
function replaceOnce(
  input: string,
  { before, after }: NonNullable<TransformEdit['transform']['replace']>,
  path: string,
) {
  const first = input.indexOf(before);
  if (first < 0 || first !== input.lastIndexOf(before))
    throw new Error(`Exact replacement must match once: ${path}`);
  return input.slice(0, first) + after + input.slice(first + before.length);
}
