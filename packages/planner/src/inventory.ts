import { parse } from 'yaml';
import type { Capture } from '../../architecture/src/index.js';

export interface StandingGoal {
  id: string;
  priority: number;
  body: string;
}

export const recordID = /^[a-z0-9][a-z0-9-]*$/;

/** Locate the active inventory under the captured project's knowledge root. */
export function goalDirectory(capture: Capture) {
  return `${capture.project.knowledgeRoot ?? '.arc'}/goals`;
}

/** Parse a goal without consulting components, enforcing current metadata on new edits. */
export function readGoal(id: string, content: string): StandingGoal {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(content);
  if (!recordID.test(id) || !match) throw new Error(`Invalid standing goal document: ${id}`);
  const [, metadata, body] = match;
  const fields = parse(metadata!) as { priority?: number; owner?: unknown } | null;
  if (!Number.isSafeInteger(fields?.priority) || !body?.trim() || 'owner' in fields!)
    throw new Error(`Standing goal requires priority and goal text without an owner: ${id}`);
  return { id, priority: fields!.priority!, body };
}

/** Read the captured inventory in priority order with stable tie-breaking. */
export function goalInventory(capture: Capture, prefix = goalDirectory(capture) + '/') {
  return capture.source.paths
    .filter((path) => path.startsWith(prefix) && path.endsWith('.md'))
    .map((path) => readGoal(path.slice(prefix.length, -3), capture.source.read(path)))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}
