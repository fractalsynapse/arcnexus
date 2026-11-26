import type { Client } from 'pg';
import { AttemptWindow } from '../attempt-window.js';
import type { JournalEvent } from '../journal-types.js';
import { readPlanReference } from './plan-records.js';
import { readImportedTimeline } from './read-timeline.js';

/** Read the selected Plan's display context while preserving the complete journal. */
export async function loadPlanEvents(database: Client, remote: string, execution: string) {
  const task = await readPlanReference(database, remote, execution);
  if (!task) throw new Error('Planning execution unavailable');
  const { events } = await readImportedTimeline(database, remote, execution);
  return { task, events: currentAttemptEvents(events, execution, task.attempt) };
}

function currentAttemptEvents(events: JournalEvent[], execution: string, attempt?: string) {
  const window = new AttemptWindow();
  let start = 0;
  for (const [index, event] of events.entries()) {
    if (window.advance(event, execution)) start = index;
  }
  return window.includes(attempt) ? events.slice(start) : [];
}
