import { parse } from 'yaml';
import type { Capture } from '../../architecture/src/index.js';
import { recordID } from './guide-data.js';
import { guideIndex } from './guide-index.js';

export interface StandingGoal {
  id: string;
  priority: number;
  body: string;
}

/** Parse a goal without consulting components, enforcing current metadata on new edits. */
export function readGoal(id: string, content: string): StandingGoal {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(content);
  if (!recordID.test(id) || !match) throw new Error(`Invalid standing goal document: ${id}`);
  const [, metadata, body] = match;
  const fields = parse(metadata!) as { priority?: number; owner?: unknown; id?: unknown } | null;
  if (fields?.id !== undefined && fields.id !== id)
    throw new Error(`A goal edit must preserve its record ID: ${id}`);
  if (!Number.isSafeInteger(fields?.priority) || !body?.trim() || 'owner' in fields!)
    throw new Error(`Standing goal requires priority and goal text without an owner: ${id}`);
  return { id, priority: fields!.priority!, body };
}

/** Read the captured inventory in priority order with stable tie-breaking. */
export function goalInventory(capture: Capture, changes?: ReadonlyMap<string, string | null>) {
  return [...guideIndex(capture, 'goals', changes).values()]
    .map(({ id, content }) => readGoal(id, content))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}
