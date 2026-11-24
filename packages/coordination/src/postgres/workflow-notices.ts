import { EventEmitter, on } from 'node:events';
import type { Client } from 'pg';
import { textDigest } from '../../../foundation/src/index.js';

const channel = 'arcnexus_workflow_requests';

/** Listen before checking for work so a concurrently submitted request cannot be missed. */
export async function subscribeWorkflowRequests(
  database: Client,
  remote: string | readonly string[],
  signal: AbortSignal,
) {
  const events = new EventEmitter();
  const lifetime = new AbortController();
  const combined = AbortSignal.any([signal, lifetime.signal]);
  const identities = new Set((typeof remote === 'string' ? [remote] : remote).map(textDigest));
  const receive = (notice: { channel: string; payload?: string }) => {
    if (notice.channel === channel && notice.payload && identities.has(notice.payload))
      events.emit('changed');
  };
  combined.throwIfAborted();
  const abort = (error: Error) => lifetime.abort(error);
  database.on('notification', receive);
  database.once('error', abort);
  const close = () => {
    database.off('notification', receive);
    database.off('error', abort);
  };
  combined.addEventListener('abort', close, { once: true });
  try {
    return await listen(database, events, combined);
  } catch (error) {
    lifetime.abort(error);
    throw error;
  }
}

async function listen(database: Client, events: EventEmitter, signal: AbortSignal) {
  const pending = on(events, 'changed', { signal });
  await database.query('LISTEN ' + channel);
  return pending;
}
