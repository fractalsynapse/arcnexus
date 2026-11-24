import type { DataScope } from '../../data/src/index.js';
import type { ResolveJournalProject } from './data.js';
import { journalChanges } from './journal-changes.js';

export type TimelineChanges = (
  scope: DataScope,
  signal: AbortSignal,
) => Promise<AsyncIterator<void>>;

/** Use the same verified project resolution for read and change observation. */
export function timelineChanges(storage: string, resolve: ResolveJournalProject): TimelineChanges {
  return async (scope, signal) => {
    const remote = await resolve(scope);
    if (!remote) throw new Error('Project journal unavailable');
    signal.throwIfAborted();
    return journalChanges(storage, remote, signal);
  };
}
