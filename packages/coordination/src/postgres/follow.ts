import { EventEmitter, on } from 'node:events';
import type { Client } from 'pg';
import { textDigest } from '../../../foundation/src/index.js';
import type { ResolveJournalProject } from '../data.js';
import type { TimelineChanges } from '../timeline-feed.js';

const channel = 'arcnexus_journal_events';

export const journalNotificationMigration = {
  id: 'coordination/journal-notifications',
  sql: `
    CREATE FUNCTION arcnexus_coordination.notify_events() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog
    AS $$
    BEGIN
      PERFORM pg_notify('${channel}', encode(sha256(convert_to(project, 'UTF8')), 'hex'))
      FROM (SELECT DISTINCT project FROM inserted) affected;
      RETURN NULL;
    END
    $$;
    CREATE TRIGGER notify_events AFTER INSERT ON arcnexus_coordination.events
    REFERENCING NEW TABLE AS inserted FOR EACH STATEMENT
    EXECUTE FUNCTION arcnexus_coordination.notify_events();
  `,
};

/** Subscribe before replay. PostgreSQL emits notices only when the writer commits. */
export function postgresTimelineChanges(
  database: Client,
  resolve: ResolveJournalProject,
): TimelineChanges {
  const notifications = new EventEmitter();
  notifications.setMaxListeners(0);
  const lifetime = new AbortController();
  database.on('notification', ({ channel: source, payload }) => {
    if (source === channel && payload && /^[a-f0-9]{64}$/.test(payload))
      notifications.emit(payload);
  });
  database.once('error', (error) => lifetime.abort(error));
  database.once('end', () => lifetime.abort());
  let listening: Promise<unknown> | undefined;
  return async (scope, signal) => {
    const remote = await resolve(scope);
    if (!remote) throw new Error('Project journal unavailable');
    const combined = AbortSignal.any([lifetime.signal, signal]);
    combined.throwIfAborted();
    await (listening ??= database.query('LISTEN ' + channel));
    combined.throwIfAborted();
    return on(notifications, textDigest(remote), { signal: combined }) as AsyncIterator<void>;
  };
}
